package com.vstms.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/tnotes")
@CrossOrigin(origins = "*")
public class TNoteController {

    @Autowired
    private TNoteService tNoteService;

    @GetMapping
    public List<TNoteEntity> getAllTNotes() {
        return tNoteService.getAllTNotes();
    }

    @GetMapping("/{id}")
    public ResponseEntity<TNoteEntity> getTNoteById(@PathVariable Long id) {
        return tNoteService.getTNoteById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public TNoteEntity createTNote(@RequestBody TNoteRequest request) {
        TNoteEntity tNote = new TNoteEntity(request.getDate(), request.getNumberOfTransformers());
        return tNoteService.saveTNote(tNote);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TNoteEntity> updateTNote(@PathVariable Long id, @RequestBody TNoteRequest request) {
        return tNoteService.getTNoteById(id)
            .map(tNote -> {
                tNote.setDate(request.getDate());
                tNote.setNumberOfTransformers(request.getNumberOfTransformers());
                return ResponseEntity.ok(tNoteService.saveTNote(tNote));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTNote(@PathVariable Long id) {
        if (tNoteService.getTNoteById(id).isPresent()) {
            tNoteService.deleteTNote(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    public static class TNoteRequest {
        private LocalDate date;
        private int numberOfTransformers;

        // getters and setters
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