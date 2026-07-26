package com.gaden.flowerknows.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TextSearchTests {

    @Test
    void foldStripsVietnameseDiacriticsAndLowercases() {
        assertEquals("nguyen van a", TextSearch.fold("  Nguyễn Văn A  "));
        assertEquals("tran thi be", TextSearch.fold("TRẦN THỊ BÉ"));
        assertEquals("doan", TextSearch.fold("Đoàn"));
        assertEquals("doan", TextSearch.fold("đoàn"));
    }

    @Test
    void containsFoldedMatchesAccentInsensitiveAndCaseInsensitive() {
        assertTrue(TextSearch.containsFolded("Nguyễn Thị Hoa", TextSearch.fold("nguyen")));
        assertTrue(TextSearch.containsFolded("Nguyễn Thị Hoa", TextSearch.fold("NGUYỄN")));
        assertTrue(TextSearch.containsFolded("Đặng Minh", TextSearch.fold("dang")));
        assertTrue(TextSearch.containsFolded("0901234567", TextSearch.fold("0901")));
        assertFalse(TextSearch.containsFolded("Nguyễn Thị Hoa", TextSearch.fold("tran")));
    }

    @Test
    void foldBlankIsEmpty() {
        assertEquals("", TextSearch.fold(null));
        assertEquals("", TextSearch.fold("   "));
    }
}
