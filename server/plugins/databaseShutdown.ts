import { definePlugin } from 'nitro';
import { closeDatabase } from '../utils/db';

export default definePlugin((app) => {
  app.hooks.hook('close', closeDatabase);
});
