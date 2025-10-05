import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'liga-do-bem-secret-key';

export const generateToken = (payload: any) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};
