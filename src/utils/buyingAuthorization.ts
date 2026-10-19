export function canRecordBuyingPayment(user?: { role: string; status: string } | null): boolean {
  return user?.status === 'approved' && ['scale_operator', 'yard_manager', 'admin'].includes(user.role);
}
