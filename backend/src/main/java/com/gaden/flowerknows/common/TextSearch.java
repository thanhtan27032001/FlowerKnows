package com.gaden.flowerknows.common;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Case- and accent-insensitive text helpers for search (Vietnamese-friendly).
 * Folds đ/Đ to d and strips combining diacritics after NFD normalization.
 */
public final class TextSearch {

    private TextSearch() {
    }

    public static String fold(String input) {
        if (input == null || input.isBlank()) {
            return "";
        }
        String lower = input.trim()
                .toLowerCase(Locale.ROOT)
                .replace('đ', 'd')
                .replace('Đ', 'd');
        return Normalizer.normalize(lower, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
    }

    public static boolean containsFolded(String haystack, String foldedNeedle) {
        if (foldedNeedle == null || foldedNeedle.isEmpty()) {
            return true;
        }
        return fold(haystack).contains(foldedNeedle);
    }
}
