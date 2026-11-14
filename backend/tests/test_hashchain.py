from common.hashchain import ZERO_HASH, canonical_json, hash_entry, verify_chain

# The same entry and the same expected hash are hardcoded in
# frontend/src/lib/hashchain.test.ts. If either side changes, both tests fail.
KNOWN_ENTRY = {
    "deviceId": "5eedde70-0000-4000-8000-00000000d340",
    "seq": 0,
    "type": "IN",
    "clientTs": "2026-11-10T08:02:11-07:00",
    "lat": 33.4242, "lng": -111.9281, "accuracyM": 12,
    "prevHash": ZERO_HASH,
}
KNOWN_CANONICAL = (
    '{"accuracyM":12,"clientTs":"2026-11-10T08:02:11-07:00",'
    '"deviceId":"5eedde70-0000-4000-8000-00000000d340","lat":"33.424200","lng":"-111.928100",'
    '"prevHash":"' + ZERO_HASH + '","seq":0,"type":"IN"}'
)
KNOWN_HASH = "5b3c06b3c31410205a88c8c3786d9acaaa43ba37c2bfa7a21b88a88ead79ee74"


def chain(n):
    entries, prev = [], ZERO_HASH
    for seq in range(n):
        entry = {**KNOWN_ENTRY, "seq": seq, "type": "IN" if seq % 2 == 0 else "OUT", "prevHash": prev}
        entry["hash"] = prev = hash_entry(entry)
        entries.append(entry)
    return entries


def test_canonical_json_is_sorted_and_compact():
    assert canonical_json(KNOWN_ENTRY) == KNOWN_CANONICAL


def test_known_hash_matches_the_frontend():
    assert hash_entry(KNOWN_ENTRY) == KNOWN_HASH


def test_missing_location_hashes_as_null():
    entry = {**KNOWN_ENTRY, "lat": None, "lng": None, "accuracyM": None}
    assert '"lat":null,"lng":null' in canonical_json(entry)


def test_server_fields_do_not_change_the_hash():
    assert hash_entry({**KNOWN_ENTRY, "serverTs": "2026-11-10T15:02:12+00:00", "hash": "x"}) == KNOWN_HASH


def test_valid_chain_verifies():
    assert verify_chain(chain(6)) == {"valid": True, "brokenAtSeq": None, "count": 6}
    assert verify_chain([]) == {"valid": True, "brokenAtSeq": None, "count": 0}


def test_edited_entry_breaks_the_chain_at_that_entry():
    entries = chain(6)
    entries[3]["clientTs"] = "2026-11-10T09:02:11-07:00"
    assert verify_chain(entries) == {"valid": False, "brokenAtSeq": 3, "count": 6}


def test_edit_with_recomputed_hash_breaks_at_the_next_entry():
    entries = chain(6)
    entries[3]["clientTs"] = "2026-11-10T09:02:11-07:00"
    entries[3]["hash"] = hash_entry(entries[3])
    assert verify_chain(entries)["brokenAtSeq"] == 4


def test_deleted_entry_breaks_the_chain():
    entries = chain(6)
    del entries[2]
    assert verify_chain(entries)["valid"] is False
