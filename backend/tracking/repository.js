const crypto = require('crypto');

class TrackingRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  static makeProofHash(proofHex) {
    return crypto.createHash('sha256').update(String(proofHex || '')).digest('hex');
  }

  static newProofRecordId() {
    return crypto.randomUUID();
  }

  static toBigIntOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    return BigInt(value);
  }

  async resolveCircuitSetupId(circuitName, explicitId) {
    if (explicitId) return explicitId;
    const activeSetup = await this.prisma.zkCircuitSetup.findFirst({
      where: {
        circuitName,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });
    return activeSetup?.id || null;
  }

  async upsertGameSession(payload) {
    await this.prisma.gameSession.upsert({
      where: {
        game_sessions_chain_id_game_id: {
          chainId: payload.chainId,
          gameId: String(payload.gameId),
        },
      },
      create: {
        chainId: payload.chainId,
        gameId: String(payload.gameId),
        roomId: payload.roomId,
        ownerAddress: payload.ownerAddress,
        isPrivate: Boolean(payload.isPrivate),
        gameCodeHash: payload.gameCodeHash || null,
        status: payload.status || 'not_started',
      },
      update: {
        roomId: payload.roomId,
        ownerAddress: payload.ownerAddress,
        isPrivate: Boolean(payload.isPrivate),
        gameCodeHash: payload.gameCodeHash || null,
        status: payload.status || 'not_started',
      },
    });
  }

  async updateGameStatus(payload) {
    await this.prisma.gameSession.updateMany({
      where: {
        chainId: payload.chainId,
        gameId: String(payload.gameId),
      },
      data: {
        status: payload.status,
      },
    });
  }

  async upsertProofRecord(payload) {
    const proofRecordId = payload.id || TrackingRepository.newProofRecordId();
    const proofHash = payload.proofHash || TrackingRepository.makeProofHash(payload.proofHex);
    const circuitSetupId = await this.resolveCircuitSetupId(payload.circuitName, payload.circuitSetupId);

    if (!circuitSetupId) {
      throw new Error(`No active circuit setup found for circuit=${payload.circuitName}`);
    }

    await this.prisma.proofRecord.upsert({
      where: { id: proofRecordId },
      create: {
        id: proofRecordId,
        chainId: payload.chainId,
        gameId: String(payload.gameId),
        roomId: payload.roomId,
        circuitName: payload.circuitName,
        circuitSetupId,
        playerAddress: payload.playerAddress || null,
        proofHex: payload.proofHex,
        proofHash,
        publicInputs: payload.publicInputs || [],
        localVerified: payload.localVerified ?? null,
        kurierJobId: payload.kurierJobId || null,
        kurierStatus: payload.kurierStatus || null,
        aggregationId: TrackingRepository.toBigIntOrNull(payload.aggregationId),
        domainId: TrackingRepository.toBigIntOrNull(payload.domainId),
      },
      update: {
        chainId: payload.chainId,
        gameId: String(payload.gameId),
        roomId: payload.roomId,
        circuitName: payload.circuitName,
        circuitSetupId,
        playerAddress: payload.playerAddress || null,
        proofHex: payload.proofHex,
        proofHash,
        publicInputs: payload.publicInputs || [],
        localVerified: payload.localVerified ?? null,
        kurierJobId: payload.kurierJobId || null,
        kurierStatus: payload.kurierStatus || null,
        aggregationId: TrackingRepository.toBigIntOrNull(payload.aggregationId),
        domainId: TrackingRepository.toBigIntOrNull(payload.domainId),
      },
    });

    return { id: proofRecordId, proofHash };
  }

  async updateKurier(payload) {
    await this.prisma.proofRecord.updateMany({
      where: { id: payload.proofRecordId },
      data: {
        kurierJobId: payload.kurierJobId || undefined,
        kurierStatus: payload.kurierStatus || undefined,
        aggregationId: payload.aggregationId !== undefined ? TrackingRepository.toBigIntOrNull(payload.aggregationId) : undefined,
        domainId: payload.domainId !== undefined ? TrackingRepository.toBigIntOrNull(payload.domainId) : undefined,
      },
    });
  }

  async upsertAggregationVerification(payload) {
    await this.prisma.aggregationVerification.upsert({
      where: {
        aggregation_verifications_proof_domain_agg: {
          proofRecordId: payload.proofRecordId,
          domainId: BigInt(payload.domainId),
          aggregationId: BigInt(payload.aggregationId),
        },
      },
      create: {
        proofRecordId: payload.proofRecordId,
        zkverifyContractAddress: payload.zkverifyContractAddress,
        domainId: BigInt(payload.domainId),
        aggregationId: BigInt(payload.aggregationId),
        leaf: payload.leaf,
        merklePath: payload.merklePath || [],
        leafCount: BigInt(payload.leafCount),
        leafIndex: BigInt(payload.leafIndex),
        verified: payload.verified ?? null,
        txHash: payload.txHash || null,
      },
      update: {
        zkverifyContractAddress: payload.zkverifyContractAddress,
        leaf: payload.leaf,
        merklePath: payload.merklePath || [],
        leafCount: BigInt(payload.leafCount),
        leafIndex: BigInt(payload.leafIndex),
        verified: payload.verified ?? null,
        txHash: payload.txHash || null,
      },
    });
  }

  async upsertCircuitSetup(payload) {
    const record = await this.prisma.zkCircuitSetup.upsert({
      where: {
        zk_circuit_setup_circuit_name_artifact_sha256: {
          circuitName: payload.circuitName,
          artifactSha256: payload.artifactSha256,
        },
      },
      create: {
        circuitName: payload.circuitName,
        proofSystem: payload.proofSystem || 'ultrahonk',
        compiledCircuitJson: payload.compiledCircuitJson,
        artifactSha256: payload.artifactSha256,
        noirVersion: payload.noirVersion || null,
        circuitHash: payload.circuitHash || null,
        verificationKeyHex: payload.verificationKeyHex,
        vkHash: payload.vkHash,
        isActive: payload.isActive ?? true,
      },
      update: {
        proofSystem: payload.proofSystem || 'ultrahonk',
        compiledCircuitJson: payload.compiledCircuitJson,
        noirVersion: payload.noirVersion || null,
        circuitHash: payload.circuitHash || null,
        verificationKeyHex: payload.verificationKeyHex,
        vkHash: payload.vkHash,
        isActive: payload.isActive ?? true,
      },
    });

    if (payload.isActive !== false) {
      await this.prisma.zkCircuitSetup.updateMany({
        where: {
          circuitName: payload.circuitName,
          id: { not: record.id },
          isActive: true,
        },
        data: { isActive: false },
      });
    }
  }
}

module.exports = TrackingRepository;
