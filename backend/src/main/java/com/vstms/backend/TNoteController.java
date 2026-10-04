package com.vstms.backend;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.vstms.backend.model.TNoteDTO;
import com.vstms.backend.model.AttachmentDTO;
import com.vstms.backend.model.TransformerDTO;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
        if (request.getTNoteNo() == null || request.getTNoteNo().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "TNote number is required.");
        }
        TNoteDTO tNote = new TNoteDTO(null, request.getDate(), request.getNumberOfTransformers(), new ArrayList<>());
        tNote.setTNoteNo(request.getTNoteNo().trim());
        tNote.setAttachments(request.getAttachments());
        return googleSheetsService.saveTNote(tNote);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TNoteDTO> updateTNote(@PathVariable Long id, @RequestBody TNoteRequest request) {
        if (request.getTNoteNo() == null || request.getTNoteNo().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "TNote number is required.");
        }
        TNoteDTO tNote = new TNoteDTO(id, request.getDate(), request.getNumberOfTransformers(), new ArrayList<>());
        tNote.setTNoteNo(request.getTNoteNo().trim());
        tNote.setAttachments(request.getAttachments());
        return ResponseEntity.ok(googleSheetsService.updateTNote(tNote));
    }

    @PostMapping("/{id}/attachments")
    public TNoteDTO addTNoteAttachments(
            @PathVariable Long id,
            @Valid @RequestBody AddTNoteAttachmentsRequest request) {
        return googleSheetsService.addTNoteAttachments(id, request.attachments());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTNote(@PathVariable Long id) {
        if (googleSheetsService.getTNoteById(id).isPresent()) {
            googleSheetsService.deleteTNote(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/transformers")
    public TransformerDTO linkExistingTransformer(@PathVariable Long id, @RequestBody LinkTransformerRequest request) {
        if (request.transformerId() == null || !"RGP".equalsIgnoreCase(request.intakeType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An existing transformer can only be linked as an RGP visit.");
        }
        return googleSheetsService.linkExistingTransformerToTNote(id, request.transformerId());
    }

    @PatchMapping("/{id}/transformers/{transformerId}/visit-status")
    public TransformerDTO updateRgpVisitStatus(
            @PathVariable Long id,
            @PathVariable Long transformerId,
            @Valid @RequestBody UpdateVisitStatusRequest request) {
        return googleSheetsService.updateRgpVisitStatus(id, transformerId, request.visitStatus());
    }

    @DeleteMapping("/{id}/transformers/{transformerId}")
    public ResponseEntity<Void> unlinkTransformer(@PathVariable Long id, @PathVariable Long transformerId) {
        googleSheetsService.unlinkTransformerFromTNote(id, transformerId);
        return ResponseEntity.noContent().build();
    }

    public record LinkTransformerRequest(Long transformerId, String intakeType) {}

    public record AddTNoteAttachmentsRequest(
            @jakarta.validation.constraints.NotEmpty List<AttachmentDTO> attachments) {}

    public record UpdateVisitStatusRequest(@jakarta.validation.constraints.NotBlank String visitStatus) {}

    public static class TNoteRequest {
        private String tNoteNo;
        private LocalDate date;
        private int numberOfTransformers;
        private List<AttachmentDTO> attachments = new ArrayList<>();

        @JsonProperty("tNoteNo")
        public String getTNoteNo() {
            return tNoteNo;
        }

        @JsonProperty("tNoteNo")
        public void setTNoteNo(String tNoteNo) {
            this.tNoteNo = tNoteNo;
        }

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

        public List<AttachmentDTO> getAttachments() {
            return attachments;
        }

        public void setAttachments(List<AttachmentDTO> attachments) {
            this.attachments = attachments != null ? attachments : new ArrayList<>();
        }
    }
}
