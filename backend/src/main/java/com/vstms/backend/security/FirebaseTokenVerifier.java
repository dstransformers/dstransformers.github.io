package com.vstms.backend.security;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FirebaseTokenVerifier {
    private static final System.Logger LOGGER = System.getLogger(FirebaseTokenVerifier.class.getName());

    private final String projectId;
    private final Set<String> adminEmails;
    private FirebaseAuth firebaseAuth;

    public FirebaseTokenVerifier(
            @Value("${app.firebase.project-id:}") String projectId,
            @Value("${app.admin.emails:}") String configuredAdminEmails) {
        this.projectId = projectId.trim();
        this.adminEmails = Arrays.stream(configuredAdminEmails.split(","))
                .map(String::trim)
                .filter(email -> !email.isEmpty())
                .map(email -> email.toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
    }

    public Optional<String> verifyAdminToken(String token) {
        try {
            FirebaseToken decodedToken = getFirebaseAuth().verifyIdToken(token, true);
            String email = decodedToken.getEmail();
            if (!decodedToken.isEmailVerified()) {
                LOGGER.log(System.Logger.Level.WARNING, "Firebase admin access denied: email is not verified.");
                return Optional.empty();
            }
            if (email == null || !adminEmails.contains(email.toLowerCase(Locale.ROOT))) {
                LOGGER.log(System.Logger.Level.WARNING, "Firebase admin access denied: account is not on the admin allowlist.");
                return Optional.empty();
            }
            return Optional.of(email);
        } catch (FirebaseAuthException exception) {
            LOGGER.log(System.Logger.Level.WARNING,
                    "Firebase ID token verification failed ({0}).",
                    exception.getClass().getSimpleName());
            return Optional.empty();
        } catch (IOException exception) {
            LOGGER.log(System.Logger.Level.ERROR,
                    "Firebase Admin SDK initialization failed ({0}).",
                    exception.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private synchronized FirebaseAuth getFirebaseAuth() throws IOException {
        if (firebaseAuth != null) {
            return firebaseAuth;
        }
        if (projectId.isBlank() || adminEmails.isEmpty()) {
            throw new IllegalStateException("Firebase project and admin email allowlist must be configured.");
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
}
