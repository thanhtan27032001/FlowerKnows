CREATE TABLE campaign_participant_turn (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
    campaign_participant_id UUID NOT NULL REFERENCES campaign_participant(id) ON DELETE CASCADE,
    turn_number INT NOT NULL,
    bag_count INT NOT NULL,
    note VARCHAR(500),
    UNIQUE (campaign_id, turn_number)
);

CREATE INDEX idx_participant_turn_participant ON campaign_participant_turn (campaign_participant_id);
