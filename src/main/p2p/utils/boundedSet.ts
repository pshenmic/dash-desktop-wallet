// Dedupe memory that forgets wholesale at the cap: the entries are short-lived
// "already seen" marks, not state worth evicting one at a time.
export class BoundedSet<T> {
  private readonly items = new Set<T>()

  constructor(private readonly limit: number) {}

  get size(): number {
    return this.items.size
  }

  has(item: T): boolean {
    return this.items.has(item)
  }

  add(item: T): void {
    if (this.items.size >= this.limit) this.items.clear()
    this.items.add(item)
  }

  delete(item: T): boolean {
    return this.items.delete(item)
  }

  clear(): void {
    this.items.clear()
  }
}
