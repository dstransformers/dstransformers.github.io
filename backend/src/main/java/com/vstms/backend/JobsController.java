package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.HashMap;

/**
 * REST Controller for Job operations (Google Sheets Integration)
 * 
 * Handles:
 * - Create jobs
 * - Retrieve jobs
 * - Filter jobs by status
 */
@RestController
@RequestMapping("/api/jobs")
public class JobsController {
  
  @Autowired
  private GoogleSheetsService googleSheetsService;

  /**
   * Create a new job
   * POST /api/jobs
   */
  @PostMapping
  public ResponseEntity<?> addJob(@RequestBody Map<String, Object> jobData) {
    try {
      Map<String, Object> result = googleSheetsService.addJob(jobData);
      
      if ("SUCCESS".equals(result.get("status"))) {
        return ResponseEntity.ok(result);
      } else {
        return ResponseEntity.badRequest().body(result);
      }
    } catch (Exception e) {
      return ResponseEntity.internalServerError().body(
        createErrorResponse("Failed to create job: " + e.getMessage())
      );
    }
  }

  /**
   * Get all jobs
   * GET /api/jobs
   */
  @GetMapping
  public ResponseEntity<?> getAllJobs() {
    try {
      Map<String, Object> result = googleSheetsService.getAllJobs();
      
      if ("SUCCESS".equals(result.get("status"))) {
        return ResponseEntity.ok(result);
      } else {
        return ResponseEntity.badRequest().body(result);
      }
    } catch (Exception e) {
      return ResponseEntity.internalServerError().body(
        createErrorResponse("Failed to fetch jobs: " + e.getMessage())
      );
    }
  }

  /**
   * Get jobs by status
   * GET /api/jobs/status/{status}
   */
  @GetMapping("/status/{status}")
  public ResponseEntity<?> getJobsByStatus(@PathVariable String status) {
    try {
      Map<String, Object> result = googleSheetsService.getJobsByStatus(status);
      
      if ("SUCCESS".equals(result.get("status"))) {
        return ResponseEntity.ok(result);
      } else {
        return ResponseEntity.badRequest().body(result);
      }
    } catch (Exception e) {
      return ResponseEntity.internalServerError().body(
        createErrorResponse("Failed to fetch jobs: " + e.getMessage())
      );
    }
  }
  
  /**
   * Helper method to create error response
   */
  private Map<String, Object> createErrorResponse(String message) {
    Map<String, Object> response = new HashMap<>();
    response.put("status", "ERROR");
    response.put("message", message);
    return response;
  }

}
