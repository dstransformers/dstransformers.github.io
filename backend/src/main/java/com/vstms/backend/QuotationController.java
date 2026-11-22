package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/quotations")
public class QuotationController {

    @Autowired
    private GoogleSheetsService googleSheetsService;

    @GetMapping(value = "/letterhead", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<Resource> getLocalLetterhead() {
        Resource letterhead = new ClassPathResource("DS_Transformers_A4_Template.png");
        if (!letterhead.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.noCache())
                .body(letterhead);
    }

    @GetMapping("/config")
    public ResponseEntity<?> getQuotationConfig() {
        return responseFor(googleSheetsService.getQuotationConfig());
    }

    @GetMapping
    public ResponseEntity<?> getAllQuotations() {
        return responseFor(googleSheetsService.getAllQuotations());
    }

    @GetMapping("/{quotationNo}")
    public ResponseEntity<?> getQuotation(@PathVariable String quotationNo) {
        return responseFor(googleSheetsService.getQuotationByNo(quotationNo));
    }

    @PostMapping
    public ResponseEntity<?> createQuotation(@RequestBody Map<String, Object> quotation) {
        quotation.remove("quotationNo");
        return responseFor(googleSheetsService.saveQuotation(quotation));
    }

    @PostMapping("/reserve-numbers")
    public ResponseEntity<?> reserveQuotationNumbers(@RequestBody Map<String, Object> request) {
        return responseFor(googleSheetsService.reserveQuotationNumbers(request));
    }

    @PostMapping("/generated")
    public ResponseEntity<?> saveGeneratedQuotationGroup(@RequestBody Map<String, Object> request) {
        return responseFor(googleSheetsService.saveGeneratedQuotationGroup(request));
    }

    @PutMapping
    public ResponseEntity<?> updateQuotation(@RequestBody Map<String, Object> quotation) {
        if (quotation.get("quotationNo") == null || quotation.get("quotationNo").toString().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("status", "ERROR", "message", "Quotation number is required."));
        }
        return responseFor(googleSheetsService.saveQuotation(quotation));
    }

    @DeleteMapping("/{quotationNo}")
    public ResponseEntity<?> deleteQuotation(@PathVariable String quotationNo) {
        return deleteQuotationByNumber(quotationNo);
    }

    @DeleteMapping
    public ResponseEntity<?> deleteQuotationByQuery(@RequestParam String quotationNo) {
        return deleteQuotationByNumber(quotationNo);
    }

    private ResponseEntity<?> deleteQuotationByNumber(String quotationNo) {
        if (quotationNo.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("status", "ERROR", "message", "Quotation number is required."));
        }
        return responseFor(googleSheetsService.deleteQuotation(quotationNo));
    }

    private ResponseEntity<?> responseFor(Map<String, Object> result) {
        if ("SUCCESS".equals(result.get("status"))) {
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(result);
    }
}
