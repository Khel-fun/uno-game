// Shuffle verification utilities
// Based on check_shuffle library - efficient permutation verification

/// Unconstrained helper to find mapping indices between two arrays
/// For each element in lhs, finds where it appears in rhs
unconstrained fn __get_shuffle_indices<let N: u32>(
    lhs: [Field; N],
    rhs: [Field; N]
) -> [u32; N] {
    let mut shuffle_indices: [u32; N] = [0; N];
    let mut shuffle_mask: [bool; N] = [false; N];
    
    for i in 0..N {
        let mut found = false;
        for j in 0..N {
            if ((shuffle_mask[j] == false) & (!found)) {
                if (lhs[i] == rhs[j]) {
                    found = true;
                    shuffle_indices[i] = j;
                    shuffle_mask[j] = true;
                }
            }
            if (found) {
                continue;
            }
        }
        assert(found == true, "check_shuffle: lhs and rhs arrays do not contain equivalent values");
    }
    
    shuffle_indices
}

/// Unconstrained helper to find reverse index
unconstrained fn __get_index<let N: u32>(indices: [u32; N], idx: u32) -> u32 {
    let mut result = 0;
    for i in 0..N {
        if (indices[i] == idx) {
            result = i;
            break;
        }
    }
    result
}

/// Main shuffle verification function
/// Verifies that rhs is a valid permutation of lhs
pub fn check_shuffle<let N: u32>(lhs: [Field; N], rhs: [Field; N]) {
    // Safety: __get_shuffle_indices is unconstrained but verified by assertions below
    let shuffle_indices = unsafe { __get_shuffle_indices(lhs, rhs) };

    // Verify shuffle_indices forms a valid bijection
    for i in 0..N {
        // Safety: __get_index is unconstrained but verified by assertion below
        let idx = unsafe { __get_index(shuffle_indices, i) };
        // Checks the relation between shuffle_indices and output of __get_index
        assert(shuffle_indices[idx] == i, "Invalid bijection in shuffle_indices");
    }
    
    // Verify the actual element mapping
    for i in 0..N {
        let idx = shuffle_indices[i];
        let expected = rhs[idx];
        let result = lhs[i];
        // Checks the relation between shuffle_indices and the lhs, rhs inputs
        assert(expected == result, "Element mismatch in shuffle");
    }
}

/// Get shuffle indices with verification
/// Returns the permutation array that maps lhs -> rhs
pub fn get_shuffle_indices<let N: u32>(
    lhs: [Field; N],
    rhs: [Field; N]
) -> [u32; N] {
    // Safety: Verified by assertions below
    let shuffle_indices = unsafe { __get_shuffle_indices(lhs, rhs) };
    
    for i in 0..N {
        // Safety: Verified by assertion below
        let idx = unsafe { __get_index(shuffle_indices, i) };
        assert(shuffle_indices[idx] == i, "Invalid bijection");
    }
    
    for i in 0..N {
        let idx = shuffle_indices[i];
        let expected = rhs[idx];
        let result = lhs[i];
        assert(expected == result, "Element mismatch");
    }
    
    shuffle_indices
}

/// Alias for backwards compatibility
pub fn verify_shuffle<let N: u32>(original: [Field; N], shuffled: [Field; N]) {
    check_shuffle(original, shuffled);
}

#[test]
fn test_check_shuffle_simple() {
    let lhs: [Field; 5] = [0, 1, 2, 3, 4];
    let rhs: [Field; 5] = [2, 0, 3, 1, 4];
    check_shuffle(lhs, rhs);
    assert(get_shuffle_indices(lhs, rhs) == [1, 3, 0, 2, 4]);
}

#[test]
fn test_check_shuffle_identity() {
    let lhs: [Field; 5] = [0, 1, 2, 3, 4];
    let rhs: [Field; 5] = [0, 1, 2, 3, 4];
    check_shuffle(lhs, rhs);
    assert(get_shuffle_indices(lhs, rhs) == [0, 1, 2, 3, 4]);
}

#[test(should_fail_with = "check_shuffle: lhs and rhs arrays do not contain equivalent values")]
fn test_check_shuffle_fail() {
    let lhs: [Field; 5] = [0, 1, 2, 3, 4];
    let rhs: [Field; 5] = [0, 1, 2, 3, 5];
    check_shuffle(lhs, rhs);
}

#[test(should_fail_with = "check_shuffle: lhs and rhs arrays do not contain equivalent values")]
fn test_check_shuffle_duplicates() {
    let lhs: [Field; 5] = [0, 1, 2, 3, 4];
    let rhs: [Field; 5] = [0, 1, 2, 3, 3];
    check_shuffle(lhs, rhs);
}

#[test]
fn test_verify_shuffle_alias() {
    let original: [Field; 5] = [1, 2, 3, 4, 5];
    let shuffled: [Field; 5] = [3, 1, 4, 2, 5];
    verify_shuffle(original, shuffled);
}

#[test]
fn test_uno_deck_shuffle() {
    // Test with actual UNO card UIDs (subset for testing)
    let original: [Field; 10] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let shuffled: [Field; 10] = [7, 2, 9, 1, 5, 3, 10, 4, 6, 8];
    check_shuffle(original, shuffled);
}
