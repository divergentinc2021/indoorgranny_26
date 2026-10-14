export class Ema {
  value = 0;
  private count = 0;
  private sum = 0;
  constructor(private readonly n: number) {}
  push(x: number): number {
    this.count++;
    if (this.n <= 1) { this.value = x; return x; }
    if (this.count <= this.n) { this.sum += x; this.value = this.sum / this.count; return this.value; }
    const a = 2 / (this.n + 1);
    this.value = this.value + a * (x - this.value);
    return this.value;
  }
}
