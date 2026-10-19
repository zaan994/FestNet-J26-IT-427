import { Request, Response } from 'express';
import { crowdMetricRepository } from '../repositories/crowdMetricRepository';
import { crowdAnalysisService } from '../services/crowdAnalysisService';
import { successResponse, errorResponse } from '../types/api';

export async function getAllMetrics(req: Request, res: Response): Promise<void> {
  try {
    const metrics = await crowdMetricRepository.getAllMetrics();
    res.json(successResponse(metrics));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function getMetricByZoneId(req: Request, res: Response): Promise<void> {
  try {
    const { zoneId } = req.params;
    const metric = await crowdMetricRepository.getMetricByZoneId(zoneId);
    if (!metric) {
      res.status(404).json(errorResponse(`No crowd metric found for zone ${zoneId}`, 404));
      return;
    }
    res.json(successResponse(metric));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function triggerAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const result = await crowdAnalysisService.analyzeCrowdFlow();
    res.json(successResponse(result, 'Crowd analysis evaluated successfully'));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}
