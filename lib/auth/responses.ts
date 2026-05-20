import { NextResponse } from 'next/server';

export function authError(message = 'Unable to authenticate', status = 400) {
  return NextResponse.json({ error: { message } }, { status });
}

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
