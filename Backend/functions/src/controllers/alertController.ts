import { Request, Response } from 'express';
import { alertRepository } from '../repositories/alertRepository';
import { successResponse, errorResponse } from '../types/api';

export async function getAllAlerts(req: Request, res: Response): Promise<void> {
  try {
    const { status, limit } = req.query;
    const limitNum = limit ? parseInt(String(limit), 10) : 50;

    let alerts = await alertRepository.getAllAlerts(limitNum);
    if (status && typeof status === 'string') {
      alerts = alerts.filter((a) => a.status === status.toUpperCase());
    }

    res.json(successResponse(alerts));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function acknowledgeAlert(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { responderName } = req.body;

    const updated = await alertRepository.updateAlertStatus(id, 'ACKNOWLEDGED', responderName);
    if (!updated) {
      res.status(404).json(errorResponse(`Alert with ID ${id} not found`, 404));
      return;
    }

    res.json(successResponse(updated, 'Alert acknowledged successfully'));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function resolveAlert(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updated = await alertRepository.updateAlertStatus(id, 'RESOLVED');
    if (!updated) {
      res.status(404).json(errorResponse(`Alert with ID ${id} not found`, 404));
      return;
    }

    res.json(successResponse(updated, 'Alert resolved successfully'));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}
