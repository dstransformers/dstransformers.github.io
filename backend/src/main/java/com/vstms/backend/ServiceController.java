package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.HashMap;

/**
 * REST Controller for Service operations
 * 
 * Handles:
 * - Retrieve services
 * - Initialize services
 */
@RestController
@RequestMapping("/api/services")
@CrossOrigin(origins = "*")
public class ServiceController {
    
    @Autowired
    private GoogleSheetsService googleSheetsService;
    
    /**
     * Get all services
     * GET /api/services
     */
    @GetMapping
    public ResponseEntity<?> getServices() {
        try {
            Map<String, Object> result = googleSheetsService.getServices();
            
            if ("SUCCESS".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                createErrorResponse("Failed to fetch services: " + e.getMessage())
            );
        }
    }
    
    /**
     * Get service by ID
     * GET /api/services/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getServiceById(@PathVariable Long id) {
        try {
            Map<String, Object> result = googleSheetsService.getServiceById(id);
            
            if ("SUCCESS".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else if ("NOT_FOUND".equals(result.get("status"))) {
                return ResponseEntity.notFound().build();
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                createErrorResponse("Failed to fetch service: " + e.getMessage())
            );
        }
    }
    
    /**
     * Initialize services with default data
     * POST /api/services/init
     */
    @PostMapping("/init")
    public ResponseEntity<?> initializeServices() {
        try {
            Map<String, Object> result = googleSheetsService.initializeServices();
            
            if ("SUCCESS".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                createErrorResponse("Failed to initialize services: " + e.getMessage())
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
