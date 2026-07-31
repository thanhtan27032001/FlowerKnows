package com.gaden.flowerknows.common;

import java.util.List;
import java.util.UUID;

/**
 * Validation failure for multi-row submissions (record items, batch product create, etc.).
 */
public class BatchLineException extends BusinessException {

    private final List<LineError> lineErrors;

    public BatchLineException(String message, List<LineError> lineErrors) {
        super(message);
        this.lineErrors = lineErrors;
    }

    public List<LineError> getLineErrors() {
        return lineErrors;
    }

    public record LineError(int lineIndex, UUID productId, String message) {
    }
}
