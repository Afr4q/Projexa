declare module 'pdfreader' {
  export class PdfReader {
    parseBuffer(buffer: Buffer, callback: (err: any, item: any) => void): void
  }
}