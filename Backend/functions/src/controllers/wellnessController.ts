import { Request, Response } from 'express';
import { wellnessService } from '../services/wellnessService';

/**
 * POST /api/wellness/reading
 * Ingest a BPM + body temperature reading from a wearable device.
 * Returns the computed WBGT index, heat stress level, and next hydration reminder.
 *
 * Body: { deviceId, attendeeId?, bpm, bodyTemperature, spO2?, timestamp? }
 */
export const ingestWellnessReading = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await wellnessService.ingestWellnessReading(req.body);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.status(201).json({
      success: true,
      reading: result.reading,
      reminder: result.reminder,
    });
  } catch (err) {
    console.error('[WellnessController] ingestWellnessReading error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

/**
 * POST /api/wellness/hydration
 * Log a manual water intake entry.
 * Returns updated hydration compliance score.
 *
 * Body: { deviceId, attendeeId?, amountMl, note? }
 */
export const logHydration = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await wellnessService.logHydration(req.body);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.status(201).json({
      success: true,
      log: result.log,
      hydrationScore: result.hydrationScore,
      totalMl: result.totalMl,
    });
  } catch (err) {
    console.error('[WellnessController] logHydration error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

/**
 * GET /api/wellness/reminder/:deviceId
 * Get the current hydration reminder state for a device.
 * Returns the next reminder time, current interval, and BPM gradient.
 */
export const getHydrationReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      res.status(400).json({ success: false, error: 'deviceId is required.' });
      return;
    }
    const reminder = await wellnessService.getHydrationReminder(deviceId);
    res.json({ success: true, reminder });
  } catch (err) {
    console.error('[WellnessController] getHydrationReminder error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

/**
 * GET /api/wellness/dashboard/:deviceId
 * Return aggregated wellness dashboard data:
 *   - Hourly BPM trend, SpO2 history, heat stress history
 *   - Hydration compliance score
 *   - Current heat stress level
 */
export const getWellnessDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      res.status(400).json({ success: false, error: 'deviceId is required.' });
      return;
    }
    const dashboard = await wellnessService.getWellnessDashboard(deviceId);
    res.json({ success: true, dashboard });
  } catch (err) {
    console.error('[WellnessController] getWellnessDashboard error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

/**
 * GET /api/wellness/report/:deviceId
 * Generate a post-event wellness report.
 * Query params: eventStart (ISO), eventEnd (ISO), attendeeId?
 */
export const getPostEventReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.params;
    const { eventStart, eventEnd, attendeeId } = req.query as {
      eventStart?: string;
      eventEnd?: string;
      attendeeId?: string;
    };

    if (!deviceId) {
      res.status(400).json({ success: false, error: 'deviceId is required.' });
      return;
    }

    const start = eventStart || new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const end = eventEnd || new Date().toISOString();

    const report = await wellnessService.generatePostEventReport(deviceId, start, end, attendeeId);
    res.json({ success: true, report });
  } catch (err) {
    console.error('[WellnessController] getPostEventReport error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};
