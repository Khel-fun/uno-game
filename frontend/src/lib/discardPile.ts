import { ethers } from 'ethers';
import { Card } from './types';

export class HashedDiscardPile {
  private discardPile: Card[] = [];
  private discardPileHashes: string[] = [];

  constructor() {}

  private hashCard(card: Card): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['string', 'string'],
        [card.color, card.value]
      )
    );
  }

  public addCard(card: Card): void {
    this.discardPile.push(card);
    const cardHash = this.hashCard(card);
    this.discardPileHashes.push(cardHash);
  }

  public getTopCard(): Card | undefined {
    return this.discardPile[this.discardPile.length - 1];
  }

  public getTopCardHash(): string | undefined {
    return this.discardPileHashes[this.discardPileHashes.length - 1];
  }

  public getAllCardHashes(): string[] {
    return [...this.discardPileHashes];
  }

  public verifyCard(index: number, card: Card): boolean {
    if (index < 0 || index >= this.discardPile.length) {
      return false;
    }
    const cardHash = this.hashCard(card);
    return cardHash === this.discardPileHashes[index];
  }

  public getDiscardPileSize(): number {
    return this.discardPile.length;
  }

  public reset(): void {
    this.discardPile = [];
    this.discardPileHashes = [];
  }

  public getDiscardPileHash(): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32[]'],
        [this.discardPileHashes]
      )
    );
  }

  public reShuffleDiscardPile(): Card[] {
    for (let i = this.discardPile.length; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.discardPile[i], this.discardPile[j]] = [this.discardPile[j], this.discardPile[i]];
      }
    return this.discardPile
  }
}