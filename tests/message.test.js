import { describe, it, expect } from 'vitest';
import { sendEmail } from '../message.js';

describe('sendEmail', () => {
    it('should print a message sent text', async () => {
        expect(sendEmail('dogan.tokdemir@hotmail.com', 'Test Subject', 'Test Email Body')).toBe(undefined);
    })
});