package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/defaults")
public class DropdownDefaultsController {

    @Autowired
    private GoogleSheetsService googleSheetsService;

    @GetMapping
    public ResponseEntity<?> getDropdownDefaults() {
        Map<String, Object> result = googleSheetsService.getDropdownDefaults();
        if ("SUCCESS".equals(result.get("status"))) {
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(result);
    }
}
