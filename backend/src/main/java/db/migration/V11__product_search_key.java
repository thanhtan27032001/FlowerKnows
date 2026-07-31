package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

/**
 * Adds {@code product.search_key} for accent/case-insensitive name search (US-32),
 * backfilled with the same folding rules as {@code TextSearch.fold}.
 */
public class V11__product_search_key extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement ddl = context.getConnection().createStatement()) {
            ddl.execute("ALTER TABLE product ADD COLUMN IF NOT EXISTS search_key VARCHAR(255)");
        }

        try (
                Statement select = context.getConnection().createStatement();
                ResultSet rs = select.executeQuery("SELECT id, name FROM product");
                PreparedStatement update = context.getConnection().prepareStatement(
                        "UPDATE product SET search_key = ? WHERE id = ?"
                )
        ) {
            while (rs.next()) {
                UUID id = rs.getObject("id", UUID.class);
                String name = rs.getString("name");
                update.setString(1, fold(name));
                update.setObject(2, id);
                update.addBatch();
            }
            update.executeBatch();
        }

        try (Statement ddl = context.getConnection().createStatement()) {
            ddl.execute("UPDATE product SET search_key = '' WHERE search_key IS NULL");
            ddl.execute("ALTER TABLE product ALTER COLUMN search_key SET NOT NULL");
            ddl.execute("CREATE INDEX IF NOT EXISTS idx_product_search_key ON product (search_key)");
        }
    }

    private static String fold(String input) {
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
}
