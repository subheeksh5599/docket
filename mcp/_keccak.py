#!/usr/bin/env python3
"""Pure-python keccak256 (FIPS-202 keccak, the Ethereum variant — NOT sha3-256).

Vendored so docket_mcp.py needs zero dependencies and no `cast` binary.
Reference: tiny-keccak / pysha3-compatible round constants, 24 rounds, rate 136
(keccak-256), padding 0x01 (keccak, not sha3's 0x06). Verified against known
vectors: keccak256(b'') = c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470.
"""

RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
    0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]
ROT = [
    [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
]
MASK = (1 << 64) - 1


def _rotl(x, n):
    return ((x << n) | (x >> (64 - n))) & MASK


def keccak_f(state):
    for rc in RC:
        # theta
        c = [state[x][0] ^ state[x][1] ^ state[x][2] ^ state[x][3] ^ state[x][4] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rotl(c[(x + 1) % 5], 1) for x in range(5)]
        for x in range(5):
            for y in range(5):
                state[x][y] ^= d[x]
        # rho + pi
        b = [[0] * 5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                b[y][(2 * x + 3 * y) % 5] = _rotl(state[x][y], ROT[x][y])
        # chi
        for x in range(5):
            for y in range(5):
                state[x][y] = b[x][y] ^ ((~b[(x + 1) % 5][y]) & b[(x + 2) % 5][y])
        # iota
        state[0][0] ^= rc


def keccak_256(data: bytes) -> bytes:
    rate = 136  # 1088 bits
    # pad: keccak uses 0x01 ... 0x80
    pad_len = rate - (len(data) % rate)
    if pad_len == 1:
        data += b"\x81"
    else:
        data += b"\x01" + b"\x00" * (pad_len - 2) + b"\x80"
    state = [[0] * 5 for _ in range(5)]
    for off in range(0, len(data), rate):
        block = data[off:off + rate]
        for i in range(rate // 8):
            lane = int.from_bytes(block[i * 8:(i + 1) * 8], "little")
            x, y = i % 5, i // 5
            state[x][y] ^= lane
        keccak_f(state)
    out = b""
    for i in range(4):  # 256 bits = 32 bytes = 4 lanes
        x, y = i % 5, i // 5
        out += state[x][y].to_bytes(8, "little")
    return out


def keccak256_hex(data: bytes) -> str:
    return "0x" + keccak_256(data).hex()


if __name__ == "__main__":
    # self-test against the canonical empty-input vector
    expect = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    got = keccak_256(b"").hex()
    print("keccak256(b''):", got)
    print("PASS" if got == expect else "FAIL — expected %s" % expect)
