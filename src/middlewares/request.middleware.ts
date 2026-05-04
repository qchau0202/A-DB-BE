import { Request, Response, NextFunction } from 'express';

const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) return '\x1b[32m'; // Green
  if (status >= 300 && status < 400) return '\x1b[33m'; // Yellow
  if (status >= 400 && status < 500) return '\x1b[31m'; // Red
  return '\x1b[35m'; // Magenta for 500+
};

const resetColor = '\x1b[0m';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = getStatusColor(res.statusCode);
    const bodyStr = req.body && Object.keys(req.body).length
      ? JSON.stringify(req.body).substring(0, 200)
      : '';

    const logParts = [
      `[${timestamp}]`,
      `${req.method}`,
      `${req.originalUrl}`,
      `${statusColor}${res.statusCode}${resetColor}`,
      `${duration}ms`,
    ];

    if (bodyStr) {
      logParts.push(`body: ${bodyStr}`);
    }

    console.log(logParts.join(' | '));
  });

  next();
};

export default requestLogger;
