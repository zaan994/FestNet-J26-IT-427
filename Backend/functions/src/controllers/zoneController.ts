import { Request, Response } from 'express';
import { zoneService } from '../services/zoneService';
import { validateZoneDTO } from '../validators/zoneValidator';
import { successResponse, errorResponse } from '../types/api';

export async function getAllZones(req: Request, res: Response): Promise<void> {
  try {
    const zones = await zoneService.getAllZones();
    res.json(successResponse(zones));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function getZoneById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const zone = await zoneService.getZoneById(id);
    if (!zone) {
      res.status(404).json(errorResponse(`Zone with ID ${id} not found`, 404));
      return;
    }
    res.json(successResponse(zone));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function createZone(req: Request, res: Response): Promise<void> {
  try {
    const validation = validateZoneDTO(req.body);
    if (!validation.valid || !validation.data) {
      res.status(400).json(errorResponse(validation.error || 'Invalid zone data'));
      return;
    }

    const created = await zoneService.createZone(validation.data);
    res.status(201).json(successResponse(created, 'Zone created successfully'));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function updateZone(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updated = await zoneService.updateZone(id, req.body);
    if (!updated) {
      res.status(404).json(errorResponse(`Zone with ID ${id} not found`, 404));
      return;
    }
    res.json(successResponse(updated, 'Zone updated successfully'));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}

export async function deleteZone(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await zoneService.deleteZone(id);
    if (!deleted) {
      res.status(404).json(errorResponse(`Zone with ID ${id} not found`, 404));
      return;
    }
    res.json(successResponse({ id }, 'Zone deleted successfully'));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message || 'Internal server error'));
  }
}
