import { Request, Response } from 'express';
import { telemetryService } from '../services/telemetryService';
import { crowdAnalysisService } from '../services/crowdAnalysisService';
import { successResponse, errorResponse } from '../types/api';

export async function ingestTelemetry(req: Request, res: Response): Promise<void> {
  try {
    const result = await telemetryService.ingestTelemetry(req.body);
    if (!result.success) {
      res.status(400).json(errorResponse(result.error || 'Failed to ingest telemetry'));
      return;
    }

    // Trigger asynchronous crowd flow calculation update
    crowdAnalysisService.analyzeCrowdFlow().catch((err) => {
      console.error('[CrowdAnalysis] Background update failed:', err);
    });

    res.status(201).json(successResponse(result.telemetry, 'Telemetry recorded successfully'));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function getLiveTelemetry(req: Request, res: Response): Promise<void> {
  try {
    const devices = await telemetryService.getAllActiveDevices();
    res.json(successResponse(devices));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function getDeviceHistory(req: Request, res: Response): Promise<void> {
  try {
    const { deviceId } = req.params;
    const history = await telemetryService.getDeviceHistory(deviceId);
    res.json(successResponse(history));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}
