package com.vstms.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/**
 * Service to interact with Google Sheets via Google Apps Script
 * 
 * This service communicates with the deployed Google Apps Script
 * to read/write data from Google Sheets
 */
@Service
public class GoogleSheetsService {
    
    @Value("${google.apps.script.url}")
    private String appsScriptUrl;
    
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * Submit enquiry to Google Sheets
     */
    public Map<String, Object> submitEnquiry(Map<String, Object> enquiryData) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "ADD_ENQUIRY");
            payload.put("payload", enquiryData);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to submit enquiry: " + e.getMessage());
        }
    }
    
    /**
     * Get all enquiries from Google Sheets
     */
    public Map<String, Object> getAllEnquiries() {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_ENQUIRIES");
            payload.put("payload", new HashMap<>());
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch enquiries: " + e.getMessage());
        }
    }
    
    /**
     * Get enquiry by ID
     */
    public Map<String, Object> getEnquiryById(Long id) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_ENQUIRY_BY_ID");
            Map<String, Object> params = new HashMap<>();
            params.put("id", id);
            payload.put("payload", params);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch enquiry: " + e.getMessage());
        }
    }
    
    /**
     * Get enquiries by status
     */
    public Map<String, Object> getEnquiriesByStatus(String status) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_ENQUIRIES_BY_STATUS");
            Map<String, Object> params = new HashMap<>();
            params.put("status", status);
            payload.put("payload", params);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch enquiries by status: " + e.getMessage());
        }
    }
    
    /**
     * Get enquiries by phone number
     */
    public Map<String, Object> getEnquiriesByPhone(String phone) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_ENQUIRIES_BY_PHONE");
            Map<String, Object> params = new HashMap<>();
            params.put("phone", phone);
            payload.put("payload", params);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch enquiries by phone: " + e.getMessage());
        }
    }
    
    /**
     * Update enquiry status
     */
    public Map<String, Object> updateEnquiryStatus(Long id, String status, String notes) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "UPDATE_ENQUIRY_STATUS");
            Map<String, Object> params = new HashMap<>();
            params.put("id", id);
            params.put("status", status);
            params.put("notes", notes != null ? notes : "");
            payload.put("payload", params);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to update enquiry status: " + e.getMessage());
        }
    }
    
    // ============ SERVICE FUNCTIONS ============
    
    /**
     * Initialize services in Google Sheets
     */
    public Map<String, Object> initializeServices() {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "INIT_SERVICES");
            payload.put("payload", new HashMap<>());
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to initialize services: " + e.getMessage());
        }
    }
    
    /**
     * Get all services
     */
    public Map<String, Object> getServices() {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_SERVICES");
            payload.put("payload", new HashMap<>());
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch services: " + e.getMessage());
        }
    }
    
    /**
     * Get service by ID
     */
    public Map<String, Object> getServiceById(Long id) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_SERVICE_BY_ID");
            Map<String, Object> params = new HashMap<>();
            params.put("id", id);
            payload.put("payload", params);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch service: " + e.getMessage());
        }
    }
    
    // ============ JOB FUNCTIONS ============
    
    /**
     * Add new job
     */
    public Map<String, Object> addJob(Map<String, Object> jobData) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "ADD_JOB");
            payload.put("payload", jobData);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to add job: " + e.getMessage());
        }
    }
    
    /**
     * Get all jobs
     */
    public Map<String, Object> getAllJobs() {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_JOBS");
            payload.put("payload", new HashMap<>());
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch jobs: " + e.getMessage());
        }
    }
    
    /**
     * Get jobs by status
     */
    public Map<String, Object> getJobsByStatus(String status) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_JOBS_BY_STATUS");
            Map<String, Object> params = new HashMap<>();
            params.put("status", status);
            payload.put("payload", params);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch jobs by status: " + e.getMessage());
        }
    }
    
    // ============ TRANSFORMER FUNCTIONS ============
    
    /**
     * Add new transformer
     */
    public Map<String, Object> addTransformer(Map<String, Object> transformerData) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "ADD_TRANSFORMER");
            payload.put("payload", transformerData);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to add transformer: " + e.getMessage());
        }
    }
    
    /**
     * Get all transformers
     */
    public Map<String, Object> getAllTransformers() {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_TRANSFORMERS");
            payload.put("payload", new HashMap<>());
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch transformers: " + e.getMessage());
        }
    }
    
    // ============ BILL FUNCTIONS ============
    
    /**
     * Add new bill
     */
    public Map<String, Object> addBill(Map<String, Object> billData) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "ADD_BILL");
            payload.put("payload", billData);
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to add bill: " + e.getMessage());
        }
    }
    
    /**
     * Get all bills
     */
    public Map<String, Object> getAllBills() {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_BILLS");
            payload.put("payload", new HashMap<>());
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch bills: " + e.getMessage());
        }
    }
    
    /**
     * Get pending bills
     */
    public Map<String, Object> getPendingBills() {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "GET_PENDING_BILLS");
            payload.put("payload", new HashMap<>());
            
            String response = postToAppsScript(payload);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Failed to fetch pending bills: " + e.getMessage());
        }
    }
    
    // ============ HELPER FUNCTIONS ============
    
    /**
     * POST to Google Apps Script
     */
    private String postToAppsScript(Map<String, Object> payload) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            String jsonPayload = objectMapper.writeValueAsString(payload);
            HttpEntity<String> entity = new HttpEntity<>(jsonPayload, headers);
            
            String response = restTemplate.postForObject(appsScriptUrl, entity, String.class);
            
            return response != null ? response : "{}";
        } catch (Exception e) {
            throw new RuntimeException("Failed to communicate with Google Apps Script: " + e.getMessage());
        }
    }
    
    /**
     * Parse response from Google Apps Script
     */
    private Map<String, Object> parseResponse(String response) {
        try {
            return objectMapper.readValue(response, Map.class);
        } catch (Exception e) {
            return errorResponse("Failed to parse response: " + e.getMessage());
        }
    }
    
    /**
     * Create error response
     */
    private Map<String, Object> errorResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "ERROR");
        response.put("message", message);
        response.put("data", new ArrayList<>());
        return response;
    }
    
    /**
     * Test connection to Google Apps Script
     */
    public Map<String, Object> testConnection() {
        try {
            String url = appsScriptUrl + "?action=STATUS";
            String response = restTemplate.getForObject(url, String.class);
            return parseResponse(response);
        } catch (Exception e) {
            return errorResponse("Connection failed: " + e.getMessage());
        }
    }
}
