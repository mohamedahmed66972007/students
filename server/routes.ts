import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  insertFileSchema,
  insertExamSchema,
  insertQuizSchema,
  insertQuizAttemptSchema
} from "@shared/schema";
import { parseISO, setHours, isBefore } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  // Auth Routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const isValid = await storage.validateAdmin(username, password);

    if (isValid) {
      return res.status(200).json({ message: "Login successful" });
    } else {
      return res.status(401).json({ message: "Invalid credentials" });
    }
  });

  // File Routes
  app.get("/api/files", async (req: Request, res: Response) => {
    try {
      const subject = req.query.subject as string | undefined;
      const semester = req.query.semester as string | undefined;

      let files;
      if (subject && semester) {
        // Get files by both filters
        const bySubject = await storage.getFilesBySubject(subject);
        files = bySubject.filter(file => file.semester === semester);
      } else if (subject) {
        files = await storage.getFilesBySubject(subject);
      } else if (semester) {
        files = await storage.getFilesBySemester(semester);
      } else {
        files = await storage.getFiles();
      }

      res.json(files);
    } catch (error) {
      console.error("Error getting files:", error);
      res.status(500).json({ message: "Failed to get files" });
    }
  });

  app.get("/api/files/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getFile(id);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      res.json(file);
    } catch (error) {
      console.error("Error getting file:", error);
      res.status(500).json({ message: "Failed to get file" });
    }
  });

  app.post("/api/files", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log("File upload request:", {
        title: req.body.title,
        subject: req.body.subject,
        semester: req.body.semester,
        fileName: req.file.originalname
      });

      const fileData = {
        title: req.body.title,
        subject: req.body.subject,
        semester: req.body.semester,
        fileName: req.file.originalname,
        filePath: ""  // Will be set in the storage implementation
      };

      // Create file with proper validation
      const parseResult = insertFileSchema.safeParse({
        title: req.body.title,
        subject: req.body.subject,
        semester: req.body.semester,
        fileName: req.file.originalname,
        filePath: `/uploads/${req.file.originalname}`
      });

      if (!parseResult.success) {
        console.error("Validation error:", parseResult.error);
        return res.status(400).json({ 
          message: "Invalid file data", 
          errors: parseResult.error.errors 
        });
      }

      // Create file entry in storage
      const file = await storage.createFile(
        parseResult.data,
        req.file.buffer
      );

      res.status(201).json(file);
    } catch (error) {
      console.error("Error creating file:", error);
      res.status(500).json({ message: "Failed to create file" });
    }
  });

  app.delete("/api/files/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteFile(id);

      if (!deleted) {
        return res.status(404).json({ message: "File not found" });
      }

      res.status(200).json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Exam Routes
  app.get("/api/exams", async (req: Request, res: Response) => {
    try {
      const weekId = req.query.weekId ? parseInt(req.query.weekId as string) : undefined;

      let exams;
      if (weekId) {
        exams = await storage.getExamsByWeek(weekId);
      } else {
        exams = await storage.getExams();
      }

      res.json(exams);
    } catch (error) {
      console.error("Error getting exams:", error);
      res.status(500).json({ message: "Failed to get exams" });
    }
  });

  app.post("/api/exams", async (req: Request, res: Response) => {
    try {
      const parseResult = insertExamSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid exam data", 
          errors: parseResult.error.errors 
        });
      }

      const exam = await storage.createExam(parseResult.data);
      res.status(201).json(exam);
    } catch (error) {
      console.error("Error creating exam:", error);
      res.status(500).json({ message: "Failed to create exam" });
    }
  });

  app.delete("/api/exams/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExam(id);

      if (!deleted) {
        return res.status(404).json({ message: "Exam not found" });
      }

      res.status(200).json({ message: "Exam deleted successfully" });
    } catch (error) {
      console.error("Error deleting exam:", error);
      res.status(500).json({ message: "Failed to delete exam" });
    }
  });

    // Function to delete exams automatically
    async function deleteExpiredExams() {
      try {
        const exams = await storage.getExams();
  
        for (const exam of exams) {
          const examDate = parseISO(exam.date);
          const examDateTime = setHours(examDate, 10); // Set time to 10:00 AM
  
          // Convert current time to Saudi Arabia Standard Time (Asia/Riyadh)
          const currentTimeUTC = new Date();
          const saudiArabiaTimeZone = 'Asia/Riyadh';
          const currentTimeSaudiArabia = utcToZonedTime(currentTimeUTC, saudiArabiaTimeZone);
  
          if (isBefore(examDateTime, currentTimeSaudiArabia)) {
            // Exam date is in the past, delete the exam
            await storage.deleteExam(exam.id);
            console.log(`Exam with id ${exam.id} deleted automatically.`);
          }
        }
      } catch (error) {
        console.error("Error deleting expired exams:", error);
      }
    }
  
    // Run the function every day at midnight
    setInterval(deleteExpiredExams, 24 * 60 * 60 * 1000);

  // Quiz Routes
  app.get("/api/quizzes", async (_req: Request, res: Response) => {
    try {
      const quizzes = await storage.getQuizzes();
      res.json(quizzes);
    } catch (error) {
      console.error("Error getting quizzes:", error);
      res.status(500).json({ message: "Failed to get quizzes" });
    }
  });

  app.get("/api/quizzes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const quiz = await storage.getQuiz(id);

      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      res.json(quiz);
    } catch (error) {
      console.error("Error getting quiz:", error);
      res.status(500).json({ message: "Failed to get quiz" });
    }
  });

  app.get("/api/quizzes/code/:code", async (req: Request, res: Response) => {
    try {
      const code = req.params.code;
      const quiz = await storage.getQuizByCode(code);

      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      res.json(quiz);
    } catch (error) {
      console.error("Error getting quiz by code:", error);
      res.status(500).json({ message: "Failed to get quiz" });
    }
  });

  app.post("/api/quizzes", async (req: Request, res: Response) => {
    try {
      const parseResult = insertQuizSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid quiz data", 
          errors: parseResult.error.errors 
        });
      }

      const quiz = await storage.createQuiz(parseResult.data);
      res.status(201).json(quiz);
    } catch (error) {
      console.error("Error creating quiz:", error);
      res.status(500).json({ message: "Failed to create quiz" });
    }
  });

  app.delete("/api/quizzes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteQuiz(id);

      if (!deleted) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      res.status(200).json({ message: "Quiz deleted successfully" });
    } catch (error) {
      console.error("Error deleting quiz:", error);
      res.status(500).json({ message: "Failed to delete quiz" });
    }
  });

  // Quiz Attempts Routes
  app.get("/api/quiz-attempts/:quizId", async (req: Request, res: Response) => {
    try {
      const quizId = parseInt(req.params.quizId);
      const attempts = await storage.getQuizAttempts(quizId);
      res.json(attempts);
    } catch (error) {
      console.error("Error getting quiz attempts:", error);
      res.status(500).json({ message: "Failed to get quiz attempts" });
    }
  });

  app.post("/api/quiz-attempts", async (req: Request, res: Response) => {
    try {
      const parseResult = insertQuizAttemptSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid quiz attempt data", 
          errors: parseResult.error.errors 
        });
      }

      const attempt = await storage.createQuizAttempt(parseResult.data);
      res.status(201).json(attempt);
    } catch (error) {
      console.error("Error creating quiz attempt:", error);
      res.status(500).json({ message: "Failed to create quiz attempt" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import express from "express";