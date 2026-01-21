// Precomputed canonical card UIDs for all 108 UNO cards
// Generated using Pedersen hash with DOMAIN_CARD_UID = 1
// This eliminates the need for dynamic hashing during proof generation

pub global CANONICAL_DECK_UIDS: [Field; 108] = [
    0x1290bfac1f5b8e4178d73646434a41e8f7ff9104a6c35d5664f53bdb80830310,  // Wild Wild #1
    0x013a589ab9d3d19e4230e8a68fbaadada9c23b2869a7c0447f7c256ad01088b6,  // Wild Wild #2
    0x1a9e724ca1992cb60b2279dad12951ed24e67d95d78cef4caf6fe78299bca912,  // Wild Wild #3
    0x17e36b24f5ca3a76ae0e4678118705a09f3e416f04d9d7a05a3088698f372d54,  // Wild Wild #4
    0x2e5f062dd067914f57b53218bbac079aa6dec20448d0edaff1d513bcf0aee5a5,  // Wild Wild Draw Four #1
    0x1100b6c463af1de4dbc4e304827083f18f6d58d2fcd484fa075066a94b573bc0,  // Wild Wild Draw Four #2
    0x2746d02fec1ab5fa5eac4b39c5053eaaeeb09f0c6bc4917f1dddf7b377c699ca,  // Wild Wild Draw Four #3
    0x0b8a6525904288c33f5499ddbd1c7bf92627fb8cdeff6f4c924ed74a17e5416e,  // Wild Wild Draw Four #4
    0x222ee5a04ba48f8a0467a646f4372eef73d42fd224799a5755c974a34e8ec3e1,  // Red 0
    0x2f2b10afd44e6ae4669191803dc3239edf6d8a67bed69d352fe68e2d58100f7e,  // Red 1 #1
    0x29439ea9ace62a0f0b47f24a9267e48e6a7201039784261629911340552aff11,  // Red 1 #2
    0x1ee693689d1ce275d1dd28e0504d742652ad5d7beaea72a66dfe42110a4ead92,  // Red 2 #1
    0x26584a6ac3dd4ce9f1c23d14d4c4e39d26ad120f0931948ae847134e0c265007,  // Red 2 #2
    0x223e962e21817963b8a1cee3ada90366b44b9f30ad84cf9fa7c2b1a5fd7521c0,  // Red 3 #1
    0x0c03888728a27e192a018c812900593e6419036bfbe6b8e34adb337573262f76,  // Red 3 #2
    0x266faa90338e8bbe989d70f81f3d61d9b2fb2cada2da9161fef11440fdae64e3,  // Red 4 #1
    0x0c1624cb51022d9161451679d537eec4213baa17b9e1f1063690e0f408f692d5,  // Red 4 #2
    0x06913a433afe737a80557fc62a59e33bfd806e8bd3030103a892924d9df889cb,  // Red 5 #1
    0x080d7be3a82cb3b1900c2cf4558bd4ebc72b3fcb941e62686d9dac090d38dae6,  // Red 5 #2
    0x2f37ce6b2d36c17ed073d09404e29618ba2ad6248cd5e0af25981e0a5d84ae93,  // Red 6 #1
    0x06ae31a267f5e55c91e1c645f98044b36443c4902a0c654695e36756f8d111c6,  // Red 6 #2
    0x1d684352e823052b70575a280ceb628755fbeb475de1bc43f4321746267cc861,  // Red 7 #1
    0x2607a893db34277a5841541f9dfd481ba1d8f5a4255f3eeb75c8076fccdc3921,  // Red 7 #2
    0x01602133c874d08c930f605ad45f8baad622906115b981053327def434948ec4,  // Red 8 #1
    0x2b5ae3aa553ada57657e47760844910e2d051a33d6ef1dc5107bcf45e75a9ad8,  // Red 8 #2
    0x0626294da59d482706111727d41ae7349b70e466cff180bde5e3b58ccaed36a0,  // Red 9 #1
    0x04a19d3255132b3e788bafb8c55b53fe6a801fbf9d218b5fb0538ed24d10f85a,  // Red 9 #2
    0x07a603b7f83603368d93fed70224e678a4f2ea67905c08ea8f830b117c434a90,  // Red Skip #1
    0x13781669c99958f0b32c1c7f13d71883fcb8e644bce161bb0996241d83b88d44,  // Red Skip #2
    0x2dee58689aee87035e74d444a497f097732d5be88cfb75ec8f2132e790993068,  // Red Reverse #1
    0x2849f5c79411364ba532f8f914283b9a6ac734ba3b7408dd8a897c93778f4d5c,  // Red Reverse #2
    0x3020c73926650957c028e6d91950538e4ed3a99f9625ca0e88949f367050c0bc,  // Red Draw Two #1
    0x24c11e33441fb9caa443f09a2a2470b67d779fdb3451b4cdd38668a597ba5870,  // Red Draw Two #2
    0x2b252c883ba4a7d26348b33879e93f33ac9d501cf3d364cb3efe4120ba0f27b9,  // Green 0
    0x11b49e3ff31d727b36e082607a071e1bdce5a4b727d6a4df32b182f6346b9cc5,  // Green 1 #1
    0x088e53adeebce3b9777995679b101437ffb7b3fc3f811b90494c3d7d17bdce0d,  // Green 1 #2
    0x19426bff7b997bba6f1a06d3fe9e093ad73cf9c248f2332a2849e0acc065565a,  // Green 2 #1
    0x18f4662962f8c3edb2d986dbbf168483cb65cc451b2d2914c598d5eff4e7ff4b,  // Green 2 #2
    0x2dde0ce3fa30f7c681808fcbbd9ed7de342367fbd010c0f17e8ee288da3e7aed,  // Green 3 #1
    0x2962ef5765172ca2e3b85b27053ba8a16991085acefe0ea8a4eb6353d34a85d3,  // Green 3 #2
    0x2144f906424c801a46ce1635c76224b916c63159316bba28964944155f63b62b,  // Green 4 #1
    0x2b39bf3a96dbc9b7c1aefa769a5f16dddb4229b754830fee56af519cb4ab4fc4,  // Green 4 #2
    0x11c85a28387fe141e031b9c97ea0f56b7caeaed34c27d905e772cebce6c0e2db,  // Green 5 #1
    0x1327d1e42ee3c17aac0dbbfb43928eacad22e9f8f82b99945613e132144583be,  // Green 5 #2
    0x1fc8fcc62c2a5c18680671905c4be345928b2a5f9ddb14b7226a4486362a11d5,  // Green 6 #1
    0x2e94d3b0a5b59c671e0422edee4c0760ece26c6259c614e1985d2521d9c4c75e,  // Green 6 #2
    0x00da6529e6e8f1736c0ed823907455c8f32db4b22197106b0360a26be8dc6a47,  // Green 7 #1
    0x1fa220ea2b5cb82e7e6a509313ac67075dc50991e81c39313092ceefbfb3525a,  // Green 7 #2
    0x085a16de0fc85d336106cfe06200af38b010751694eb57bbed6ef001230d4a74,  // Green 8 #1
    0x20163ec12d57edc34c4ad78f2d4e9a7e720e33e153a1655120fc88c42e6c6675,  // Green 8 #2
    0x220cde14c55e13090c701ee74f40746049c8dfa188c7f30bd6b305a32631be40,  // Green 9 #1
    0x13d22c8f8ee55e599248207c264dcbc1cb0c2a242630f3cd99c8d7ffdb29d049,  // Green 9 #2
    0x08c412ccb41e5778ef355deee4e279b72359cc142b3f2c4ba11db642a69abb33,  // Green Skip #1
    0x0d2bb0027dca6a461e48affebeea6861c6edb23a41910ff5bdf6ef0c5b3a306f,  // Green Skip #2
    0x0f0f87a3a1e2b5ce44b6b5f87954709a28a1ff55624b642f3396121d6665d102,  // Green Reverse #1
    0x0678bd5543dbd1e3562746c5b3d5bb6e7773d7d048ecd2e62a7bc8c6b6e87128,  // Green Reverse #2
    0x15fb9819dff1edeb2fcdf8bc4802cc3f7e755ede2318941901c30ffa7c11c8d8,  // Green Draw Two #1
    0x0d0722799046d6e2f157916385e67d8f1ff1ffca8c8b7e02458f0b501785102b,  // Green Draw Two #2
    0x16fdc654bd0454cb348d8019383358ea909120e4cee03ef58c815a12014a8c6e,  // Blue 0
    0x26f73ce7297872f6d47771e0f1a3ec348da1aa6b9f1ffed620f8eddd7d78258d,  // Blue 1 #1
    0x061b8b7cdb21e015e86c43c1f98dde01753504f0a2c0c31346b5c8a29bf33837,  // Blue 1 #2
    0x1177a0ce9b0816b18702b2faba70d72e2045fc2421b25e21f3cedab1d0880d62,  // Blue 2 #1
    0x1d9cde904eaed346784e960e1b8094b227a4eedf483ff0121d715db690c7f55e,  // Blue 2 #2
    0x062744ab8ac71a6c5bd7f55cf9dfc0a4a93b1568d1e56760aad96cce77e973b0,  // Blue 3 #1
    0x1803a67818f53eac09685ed9cfe2edcb5068909162076435c6b5f6e3b22b3d93,  // Blue 3 #2
    0x1a83ef56abcc32029de9813e5eb957250109f01a89afa940e351a1aeda3fb1ce,  // Blue 4 #1
    0x0d47c98ab97ac0fb69cd70242427d6e441a8f11365e4a8beac0041bad98d4600,  // Blue 4 #2
    0x1beae722011913413c2ed6adab9bc8c777700e8544e19d3f8c589cb935bd6ba5,  // Blue 5 #1
    0x2ef9bfb80db4b87cc9e8530f5b18c91aa1cf9318e91413714081e22ce04f3a01,  // Blue 5 #2
    0x20bd672fd0e741bc1e838838680701d666c2cfdf2a9f8a14b1c274a19206b2d2,  // Blue 6 #1
    0x225ea62c50794f7e090a5ddc56fc0e4ad43829c1e53b07b9c50b0fa64b6d3a6d,  // Blue 6 #2
    0x1464e5a47c96bb4aa227c94f3723425b72eb6159495f4a793a5f269156edd164,  // Blue 7 #1
    0x1ff00599f73f962671811c4885a168497f9135d2adac53d42b18380ffdd86919,  // Blue 7 #2
    0x06881342e305fa00523d875b13ae238fa08170ab35b536013d99f9a7b4bb0dd9,  // Blue 8 #1
    0x05dad0631ea2eadaff56c9ac222ec5bd010de27e95b7a1ab933db8c61a401e90,  // Blue 8 #2
    0x28b1139922a2458c8e518b6cfca2c527886c92a3fa801bc360596858293a145f,  // Blue 9 #1
    0x0a0a0ad648f51907a11cc2906f1a03ae650ba1aa50f1798fe06c484e58e42126,  // Blue 9 #2
    0x0f2ddfa2c0cf8d759d4512d6a906430e8e83f26b46c448e128866322a2e3230e,  // Blue Skip #1
    0x167507194199198efb9bb0d4a0868ee12cbc48c65e9a87cb635f6ac7a949df67,  // Blue Skip #2
    0x159f12afc462a5a9c5615bb2fa14c14010d25095b5b7c717cdec8574eed78564,  // Blue Reverse #1
    0x2fff3e7d28738cff1de833d24ae72f49846d213b6b7fa9699ba2ace43f05d1b6,  // Blue Reverse #2
    0x0821bc45af8c40e332a60dce9af8b060033f7996630f2f689762b10a562f031f,  // Blue Draw Two #1
    0x1ab930b519bf8016b1ef2c0adf7584e7aa57f21a347a20bc5f7fed6e15e64721,  // Blue Draw Two #2
    0x06b319c14a6004a5219b13a8608a06b440def586ebd08b04e76c4047afaaad30,  // Yellow 0
    0x2eae5ad7c83269ba72e64e950a7e66fef524447a87df92b08f0d9558d5e7ec87,  // Yellow 1 #1
    0x16da84b0528ebb6fdd3affc09b759ca54333ef96166d07497e6159956121324b,  // Yellow 1 #2
    0x156fe9804db855ff768da21d5e891eb2f0091c8d223929d9a15e14357f450eae,  // Yellow 2 #1
    0x26ad40cf02c39f499a785a17ba735512312e962bff639ecdc6a1a67c98d0232b,  // Yellow 2 #2
    0x19c91a277c00724de3ff6d6bf80199a585aedcfa5465ec6daccd9e7d304646eb,  // Yellow 3 #1
    0x276df4eb91e82aae60ac5c0042065655e48f2a9a0a385b7c35bcb1218aead7ee,  // Yellow 3 #2
    0x2cfa582be6e6f803ef34024217939a5a993b8f4b9273817692b3f24efed7dc28,  // Yellow 4 #1
    0x07150de48bb2b4e80f9dad267e216d8f6bd10888275fc24909b49c758187a587,  // Yellow 4 #2
    0x11e16f62142e09c38cd84abb5f007d54a3c86d62b22144cc4a24a31a793153be,  // Yellow 5 #1
    0x2f82ac45c96b791a061ba2b041d107681227b2be896a2442fef4032d01bbe46d,  // Yellow 5 #2
    0x15a5319eb0d11591053a00ee79a768703e5a4b78aac109349d748041d62fff30,  // Yellow 6 #1
    0x067f9a3c9aee868ba62e00aff1c6037a3ebf9647ad7e027b54a916f5464028a5,  // Yellow 6 #2
    0x11e08f8ec7d606703777a7c8a9fe4b8f83d1bc396b8d86b7acc38be818d11856,  // Yellow 7 #1
    0x01c64ac9d03c365eab575ec61064243387a1996b5bf0529b868b08228a74c8f0,  // Yellow 7 #2
    0x2e1b98478dfc500ca3b9261be9c253346f0d20df15aa8f9b59cea29a8fbc87b3,  // Yellow 8 #1
    0x265b93da3fb3cec0f40f8135da4f98cd55f42ca5c25be9a60084dc69be9fa69a,  // Yellow 8 #2
    0x2d4e7ec28e5e4e9c77d7f868a353df30024ecdb2c1bcaa29ce49748c8055a935,  // Yellow 9 #1
    0x08f65b0a841fb1d5490efffed27bdfe4abdb04d92ae254628b1603299746187b,  // Yellow 9 #2
    0x05c98b617cf8834daf957e618203987062b506dd2a410e1080981c723a33c0fc,  // Yellow Skip #1
    0x0b7edd1330c0abe6bcb64dbd13b6434a89542b8e834f1ebc21e1aeed658ea959,  // Yellow Skip #2
    0x19efab91db5479bdf598f3d47c25b34cdfa57bed1e3506acda01d36365c9f143,  // Yellow Reverse #1
    0x264de5b51c6667fbc140837cee76398bd9d313069164a4e3b3475b0a30744aa0,  // Yellow Reverse #2
    0x280621fad47400c423d92c26f977c6be2a1eb30d458660492fdb08602852811f,  // Yellow Draw Two #1
    0x1e3ca3ee5b5dbe390e07a82cf1cc281a504b6dd1920b8cf2d07c074bc71889f6   // Yellow Draw Two #2
];

/// Get card UID from components using precomputed lookup table
/// This is MUCH faster than dynamic hashing (30-40% constraint reduction)
pub fn get_card_uid(color: u8, card_type: u8, copy_index: u8) -> Field {
    // Calculate index into CANONICAL_DECK_UIDS array
    // Index formula matches card generation order:
    // - Wild cards: indices 0-7
    // - Colored cards: indices 8-107 (25 cards per color * 4 colors)
    
    let idx = if color == 0 {
        // Wild cards
        if card_type == 13 {
            // Wild: indices 0-3
            copy_index as u32
        } else {
            // Wild Draw Four (type 14): indices 4-7
            4 + (copy_index as u32)
        }
    } else {
        // Colored cards: each color has 25 cards
        let color_offset = 8 + ((color - 1) as u32) * 25;
        
        if card_type == 0 {
            // Zero: first card in color
            color_offset
        } else if card_type <= 9 {
            // Number cards 1-9: 2 copies each
            color_offset + 1 + ((card_type - 1) as u32) * 2 + (copy_index as u32)
        } else {
            // Action cards (Skip=10, Reverse=11, Draw Two=12): 2 copies each
            color_offset + 19 + ((card_type - 10) as u32) * 2 + (copy_index as u32)
        }
    };
    
    CANONICAL_DECK_UIDS[idx]
}
