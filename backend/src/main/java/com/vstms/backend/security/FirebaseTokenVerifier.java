package com.vstms.backend.security;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class FirebaseTokenVerifier {
    private static final Logger LOGGER = LoggerFactory.getLogger(FirebaseTokenVerifier.class);

    private final String projectId;
    private FirebaseAuth firebaseAuth;

    public FirebaseTokenVerifier(
            @Value("${app.firebase.project-id:}") String projectId) {
        this.projectId = projectId.trim();
    }

    public Optional<String> verifyAdminToken(String token) {
        try {
            FirebaseToken decodedToken = getFirebaseAuth().verifyIdToken(token, true);
            Optional<String> adminEmail = firebaseEmail(decodedToken.getEmail());
            if (adminEmail.isEmpty()) {
                LOGGER.warn("Firebase admin access denied: account does not have an email address.");
                return Optional.empty();
            }
            return adminEmail;
        } catch (FirebaseAuthException exception) {
            LOGGER.warn("Firebase ID token verification failed ({}).", exception.getClass().getSimpleName());
            return Optional.empty();
        } catch (IOException exception) {
            LOGGER.error("Firebase Admin SDK initialization failed ({}).", exception.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private synchronized FirebaseAuth getFirebaseAuth() throws IOException {
        if (firebaseAuth != null) {
            return firebaseAuth;
        }
        if (projectId.isBlank()) {
            throw new IllegalStateException("Firebase project must be configured.");
        }

        FirebaseApp app = FirebaseApp.getApps().stream()
                .filter(existing -> existing.getName().equals("vstms-auth"))
                .findFirst()
                .orElse(null);
        if (app == null) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.getApplicationDefault())
                    .setProjectId(projectId)
                    .build();
            app = FirebaseApp.initializeApp(options, "vstms-auth");
        }
        firebaseAuth = FirebaseAuth.getInstance(app);
        return firebaseAuth;
    }

    static Optional<String> firebaseEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(email.trim());
    }
}
