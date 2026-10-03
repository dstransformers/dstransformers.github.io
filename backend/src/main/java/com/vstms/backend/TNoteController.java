package com.vstms.backend;

import com.vstms.backend.model.TNoteDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/tnotes")
public class TNoteController {

    @Autowired
    private GoogleSheetsService googleSheetsService;

    @GetMapping
    public List<TNoteDTO> getAllTNotes() {
        return googleSheetsService.getAllTNotes();
    }

    @GetMapping("/{id}")
    public ResponseEntity<TNoteDTO> getTNoteById(@PathVariable Long id) {
        return googleSheetsService.getTNoteById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public TNoteDTO createTNote(@RequestBody TNoteRequest request) {
        TNoteDTO tNote = new TNoteDTO(null, request.getDate(), request.getNumberOfTransformers(), new ArrayList<>());
        return googleSheetsService.saveTNote(tNote);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TNoteDTO> updateTNote(@PathVariable Long id, @RequestBody TNoteRequest request) {
        return googleSheetsService.getTNoteById(id)
                .map(tNote -> {
                    tNote.setDate(request.getDate());
                    tNote.setNumberOfTransformers(request.getNumberOfTransformers());
                    return ResponseEntity.ok(googleSheetsService.saveTNote(tNote));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTNote(@PathVariable Long id) {
        if (googleSheetsService.getTNoteById(id).isPresent()) {
            googleSheetsService.deleteTNote(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    public static class TNoteRequest {
        private LocalDate date;
        private int numberOfTransformers;

        public LocalDate getDate() {
            return date;
        }

        public void setDate(LocalDate date) {
            this.date = date;
        }

        public int getNumberOfTransformers() {
            return numberOfTransformers;
        }

        public void setNumberOfTransformers(int numberOfTransformers) {
            this.numberOfTransformers = numberOfTransformers;
        }
    }
}