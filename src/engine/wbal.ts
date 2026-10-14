import { DEFAULT_FTP } from './zones';
export class WBal {
  expendedJ = 0;
  private belowSum = 0;
  private belowN = 0;
  readonly cp: number;
  constructor(cpW: number, readonly wprimeJ: number) { this.cp = cpW > 0 ? cpW : DEFAULT_FTP; }
  get tau(): number {
    const dcp = this.belowN ? this.cp - this.belowSum / this.belowN : this.cp;
    return 546 * Math.exp(-0.01 * dcp) + 316;
  }
  tick(powerW: number): void {
    if (powerW < this.cp) { this.belowSum += powerW; this.belowN++; }
    this.expendedJ = this.expendedJ * Math.exp(-1 / this.tau) + Math.max(powerW - this.cp, 0);
  }
  get remainingJ(): number { return this.wprimeJ - this.expendedJ; }
  get pctExpended(): number { return this.wprimeJ > 0 ? (this.expendedJ / this.wprimeJ) * 100 : 0; }
}
