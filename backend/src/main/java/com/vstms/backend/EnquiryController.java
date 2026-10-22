package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.HashMap;

/**
 * REST Controller for Enquiry operations
 * 
 * Handles:
 * - Create enquiries
 * - Retrieve enquiries
 * - Update enquiry status
 */
@RestController
@RequestMapping("/api/enquiries")
public class EnquiryController {
    
    @Autowired
    private GoogleSheetsService googleSheetsService;
    
    /**
     * Submit a new enquiry
     * POST /api/enquiries
     */
    @PostMapping
    public ResponseEntity<?> submitEnquiry(@RequestBody Map<String, Object> enquiryData) {
        try {
            Map<String, Object> result = googleSheetsService.submitEnquiry(enquiryData);
            
            if ("SUCCESS".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                createErrorResponse("Failed to submit enquiry: " + e.getMessage())
            );
        }
    }
    
    /**
     * Get all enquiries
     * GET /api/enquiries
     */
    @GetMapping
    public ResponseEntity<?> getAllEnquiries() {
        try {
            Map<String, Object> result = googleSheetsService.getAllEnquiries();
            
            if ("SUCCESS".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                createErrorResponse("Failed to fetch enquiries: " + e.getMessage())
            );
        }
    }
    
    /**
     * Get enquiry by ID
     * GET /api/enquiries/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getEnquiryById(@PathVariable Long id) {
        try {
            Map<String, Object> result = googleSheetsService.getEnquiryById(id);
            
            if ("SUCCESS".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else if ("NOT_FOUND".equals(result.get("status"))) {
                return ResponseEntity.notFound().build();
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                createErrorResponse("Failed to fetch enquiry: " + e.getMessage())
            );
        }
    }
    
    /**
     * Get enquiries by status
     * GET /api/enquiries/status/{status}
     */
    @GetMapping("/status/{status}")
    public ResponseEntity<?> getEnquiriesByStatus(@PathVariable String status) {
        try {
            Map<String, Object> result = googleSheetsService.getEnquiriesByStatus(status);
            
            if ("SUCCESS".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                createErrorResponse("Failed to fetch enquiries: " + e.getMessage())
            );
        }
    }
    
    /**
     * Get enquiries by phone number
     * GET /api/enquiries/phone/{phone}
     */
    @GetMapping("/phone/{phone}")
    public ResponseEntity<?> getEnquiriesByPhone(@PathVariable String phone) {
        try {
            Map<String, Object> result = googleSheetsService.getEnquiriesByPhone(phone);
            
            if ("SUCCESS".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                createErrorResponse("Failed to fetch enquiries: " + e.getMessage())
            );
        }
    }
    
    /**
     * Update enquiry status
     * PUT /api/enquiries/{id}/status
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateEnquiryStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestParam(required = false) String notes) {
        try {
            Map<String, Object> result = googleSheetsService.updateEnquiryStatus(id, status, notes);
            
            if ("SUCCESS".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else if ("NOT_FOUND".equals(result.get("status"))) {
                return ResponseEntity.notFound().build();
            } else {
                return ResponseEntity.badRequest().body(result);
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                createErrorResponse("Failed to update enquiry: " + e.getMessage())
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
