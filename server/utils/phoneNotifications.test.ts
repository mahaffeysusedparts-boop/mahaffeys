import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), send: vi.fn(), preview: vi.fn(), body: vi.fn(), user: vi.fn(), admin: vi.fn(), origin: vi.fn(), transaction: vi.fn() }));
vi.mock('./db', () => ({ query: mocks.query, withTransaction: mocks.transaction }));
vi.mock('./databaseMode', () => ({ isLocalPreview: mocks.preview }));
vi.mock('web-push', () => ({ sendNotification: mocks.send, generateVAPIDKeys: () => ({ publicKey: 'public', privateKey: 'private' }) }));
vi.mock('nitro', () => ({ defineHandler: (handler: unknown) => handler }));
vi.mock('nitro/h3', () => ({
  createError: (error: object) => Object.assign(new Error(), error), readBody: mocks.body, assertBodySize: vi.fn(),
  getRequestHeaders: () => ({ origin: mocks.origin() }), getRequestURL: () => new URL('https://yard.example/api/notifications'),
}));
vi.mock('./auth', () => ({ requireUser: mocks.user, requireAdmin: mocks.admin }));
import { notifyOperatorAction, notificationAction, validPushEndpoint, pushSubscriptionSchema, sendPhonePush } from './phoneNotifications';
import saveSettings from '../routes/api/notifications/settings.put';
import registerDevice from '../routes/api/notifications/devices.post';
const save = saveSettings as unknown as (event: object) => Promise<unknown>;
const register = registerDevice as unknown as (event: object) => Promise<unknown>;
const entry = { userId: 'operator', userName: 'Operator One', action: 'purchase.paid', entity: 'purchase', detail: { customerIdNumber: 'DO-NOT-SEND', amount: 100 } };
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: Buffer.alloc(65, 1).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url') } };

beforeEach(() => {
  vi.clearAllMocks(); mocks.preview.mockReturnValue(false); mocks.origin.mockReturnValue('https://yard.example');
  mocks.user.mockResolvedValue({ id: 'recipient', role: 'yard_employee' }); mocks.admin.mockResolvedValue({ id: 'admin', role: 'admin' });
  mocks.send.mockResolvedValue({ statusCode: 201 });
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('push_server_keys')) return { rows: [{ public_key: 'public', private_key: 'private' }] };
    if (sql.includes('phone_notification_rules')) return { rows: [{ action: 'purchase.paid', recipient_ids: ['recipient'], operator_ids: ['operator'] }] };
    if (sql.includes('JOIN users')) return { rows: [{ endpoint_hash: 'hash', subscription }] };
    if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 'operator' }, { id: 'recipient' }] };
    return { rows: [] };
  });
  mocks.transaction.mockImplementation(callback => callback({ query: mocks.query }));
});

describe('phone push security and event routing', () => {
  it('only accepts supported HTTPS browser push endpoints and bounded keys', () => {
    for (const endpoint of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x']) expect(validPushEndpoint(endpoint)).toBe(true);
    for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.test/x', 'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:444/x']) expect(validPushEndpoint(endpoint)).toBe(false);
    expect(pushSubscriptionSchema.safeParse(subscription).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ ...subscription, keys: { p256dh: 'bad', auth: 'bad' } }).success).toBe(false);
  });
  it('only sends configured actions for selected operators to approved recipients', async () => {
    await notifyOperatorAction(entry);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("u.status='approved'"), [['recipient']]);
    const payload = JSON.parse(mocks.send.mock.calls[0][1]);
    expect(payload.body).toContain('Operator One');
    expect(JSON.stringify(payload)).not.toContain('DO-NOT-SEND');
    expect(mocks.send.mock.calls[0][2].vapidDetails.privateKey).toBe('private');
  });
  it('does not notify unselected actions, operators or anonymous events', async () => {
    await notifyOperatorAction({ ...entry, action: 'purchase.created' });
    await notifyOperatorAction({ ...entry, userId: 'another' });
    await notifyOperatorAction({ ...entry, userId: null });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('never sends real phone alerts from local preview', async () => {
    mocks.preview.mockReturnValue(true);
    await notifyOperatorAction(entry);
    expect(await sendPhonePush(['recipient'], 'Test', 'Test')).toMatchObject({ accepted: 0, localPreview: true });
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.query).not.toHaveBeenCalled();
  });
  it('removes expired devices and never fails an operator action on delivery error', async () => {
    mocks.send.mockRejectedValue({ statusCode: 410 });
    await expect(notifyOperatorAction(entry)).resolves.toBeUndefined();
    expect(mocks.query).toHaveBeenCalledWith('DELETE FROM phone_push_devices WHERE endpoint_hash=$1', ['hash']);
  });
  it('maps successful audit events, but not failed sign-ins or unrelated writes', () => {
    expect(notificationAction({ ...entry, action: 'auth.login' })).toBe('operator.login');
    expect(notificationAction({ ...entry, action: 'auth.login_failed' })).toBeUndefined();
    expect(notificationAction({ ...entry, action: 'state.write', entityId: 'mahaffeys_metals' })).toBe('prices.changed');
    expect(notificationAction({ ...entry, action: 'state.write', entityId: 'mahaffeys_settings' })).toBe('settings.changed');
    expect(notificationAction({ ...entry, action: 'state.write', entityId: 'mahaffeys_tasks' })).toBeUndefined();
  });
  it('rejects non-admin rule changes and foreign origins before writing anything', async () => {
    mocks.admin.mockRejectedValueOnce(Object.assign(new Error(), { statusCode: 403 }));
    await expect(save({})).rejects.toMatchObject({ statusCode: 403 });
    mocks.origin.mockReturnValue('https://evil.example');
    await expect(save({})).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('rejects recipient accounts that are not approved', async () => {
    mocks.body.mockResolvedValue({ rules: [{ action: 'purchase.paid', recipientIds: ['disabled'], operatorIds: [] }] });
    await expect(save({})).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(false);
  });
  it('cannot reassign another account’s registered device', async () => {
    mocks.body.mockResolvedValue(subscription);
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('SELECT user_id') ? [{ user_id: 'other-account' }] : [] }));
    await expect(register({})).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
  });
});
