import express, { Request, Response } from "express";
import os from "os";
import gameStorage from "../services/storage/gameStorage";

const router: express.Router = express.Router();

router.get("/health", async (_req: Request, res: Response) => {
  const redisEnabled = gameStorage.isEnabled();
  const counts = gameStorage.counts();

  res.json({
    status: "ok",
    uptime: process.uptime(),
    gameStates: counts.gameStates,
    activeRooms: counts.activeRooms,
    redisEnabled,
    storageType: redisEnabled ? "redis" : "memory",
    memory: process.memoryUsage(),
    loadavg: os.loadavg(),
  });
});

export default router;
