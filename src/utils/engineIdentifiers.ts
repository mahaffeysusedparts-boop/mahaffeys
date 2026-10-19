const knownEngineCodes = new Set('LM7 L59 LM4 L33 LH6 LC9 LY5 LMG L83 L84 LR4 LY2 L20 LQ4 LQ9 LY6 L96 LS1 LS2 LS3 LS4 LS6 LS7 L99 L92 L94 L9H ERB ERC ERF EZH EZC D17A1 D17A2 D17A6 K24Z7 K24Z3 K24A2 H22A4 J35A1 J35A3 J35A5 J35Z2 J35Z6 FB25B EJ25 EJ22E QR25DE VG30E VG33E VG33ER 2ARFE 3URFE 3URFBE 22REC 5VZFE'.split(' '));

// Recognition only: these codes do not establish interchange relationships.
export function listedEngineCodes(text: string): string[] {
  return [...new Set(text.toUpperCase().split(/[^A-Z0-9]+/).filter((word) => knownEngineCodes.has(word)))];
}
