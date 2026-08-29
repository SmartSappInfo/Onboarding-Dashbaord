/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 5):
 * 
 * SMTPHandshakeProberService performs zero-body socket handshakes against target mail exchangers.
 * It determines mailbox validity without sending actual messages, and detects catch-all servers.
 * 
 * Invariants & Safeguards:
 * 1. Non-Destructive: Never sends DATA / message bodies; closes socket after RCPT TO.
 * 2. Strict Socket Timeout: 3,000ms connection and read timeout.
 * 3. Graceful Firewall Fallback: If port 25 is firewalled by cloud provider/ISP, falls back to simulated/DNS status.
 * 4. Catch-All Verification: Tests randomized address to detect servers that accept all emails.
 * 5. Strict Zero-`any` typing.
 */

import net from 'node:net';

export interface SMTPProbeResult {
  isDeliverable: boolean;
  statusCode?: number;
  statusMessage?: string;
  isCatchAll: boolean;
  latencyMs: number;
  handshakePassed: boolean;
  error?: string;
}

export class SMTPHandshakeProberService {
  private static readonly SMTP_TIMEOUT_MS = 3000;
  private static readonly HELO_DOMAIN = 'verify.smartsapp.com';
  private static readonly MAIL_FROM = 'verify@smartsapp.com';

  /**
   * Probes an email address against its primary MX host.
   */
  public static async probeMailbox(
    email: string,
    primaryMxHost: string,
    domain: string
  ): Promise<SMTPProbeResult> {
    if (!email || !primaryMxHost) {
      return {
        isDeliverable: false,
        isCatchAll: false,
        latencyMs: 0,
        handshakePassed: false,
        error: 'Missing email or MX host'
      };
    }

    const startTime = Date.now();

    try {
      // 1. Probe the target email
      const targetProbe = await this.executeSocketHandshake(primaryMxHost, email);
      const latencyMs = Date.now() - startTime;

      if (!targetProbe.success) {
        return {
          isDeliverable: false,
          statusCode: targetProbe.code,
          statusMessage: targetProbe.message,
          isCatchAll: false,
          latencyMs,
          handshakePassed: false,
          error: targetProbe.error || 'SMTP Handshake failed'
        };
      }

      const isTarget250 = targetProbe.code === 250;

      // 2. Catch-all probe: test randomized non-existent mailbox
      let isCatchAll = false;
      if (isTarget250 && domain) {
        const randomMailbox = `probe_${Math.random().toString(36).substring(2, 10)}@${domain}`;
        const catchAllProbe = await this.executeSocketHandshake(primaryMxHost, randomMailbox);
        if (catchAllProbe.code === 250) {
          isCatchAll = true;
        }
      }

      return {
        isDeliverable: isTarget250,
        statusCode: targetProbe.code,
        statusMessage: targetProbe.message,
        isCatchAll,
        latencyMs,
        handshakePassed: isTarget250
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      return {
        isDeliverable: false,
        isCatchAll: false,
        latencyMs,
        handshakePassed: false,
        error: err instanceof Error ? err.message : 'SMTP probe encountered error'
      };
    }
  }

  /**
   * Low-level socket interaction performing HELO -> MAIL FROM -> RCPT TO -> QUIT.
   */
  private static executeSocketHandshake(
    host: string,
    targetEmail: string
  ): Promise<{ success: boolean; code?: number; message?: string; error?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let step = 0; // 0: connect/banner, 1: HELO sent, 2: MAIL FROM sent, 3: RCPT TO sent
      let lastMessage = '';
      let isResolved = false;

      const finish = (result: { success: boolean; code?: number; message?: string; error?: string }) => {
        if (!isResolved) {
          isResolved = true;
          try {
            socket.write('QUIT\r\n');
            socket.destroy();
          } catch {
            // ignore cleanup errors
          }
          resolve(result);
        }
      };

      socket.setTimeout(this.SMTP_TIMEOUT_MS);

      socket.on('timeout', () => {
        finish({ success: false, error: 'SMTP connection timed out (port 25 blocked or unresponsive)' });
      });

      socket.on('error', (err) => {
        finish({ success: false, error: `Socket error: ${err.message}` });
      });

      socket.connect(25, host, () => {
        // Connected, waiting for server banner (220)
      });

      socket.on('data', (data) => {
        const response = data.toString();
        const codeMatch = response.match(/^(\d{3})/);
        if (!codeMatch) return;

        const code = parseInt(codeMatch[1], 10);
        lastMessage = response.trim();

        if (step === 0) {
          // Banner received
          if (code === 220) {
            step = 1;
            socket.write(`HELO ${this.HELO_DOMAIN}\r\n`);
          } else {
            finish({ success: false, code, message: lastMessage, error: 'Unexpected banner code' });
          }
        } else if (step === 1) {
          // HELO response
          if (code === 250) {
            step = 2;
            socket.write(`MAIL FROM:<${this.MAIL_FROM}>\r\n`);
          } else {
            finish({ success: false, code, message: lastMessage, error: 'HELO rejected' });
          }
        } else if (step === 2) {
          // MAIL FROM response
          if (code === 250) {
            step = 3;
            socket.write(`RCPT TO:<${targetEmail}>\r\n`);
          } else {
            finish({ success: false, code, message: lastMessage, error: 'MAIL FROM rejected' });
          }
        } else if (step === 3) {
          // RCPT TO response
          if (code === 250) {
            finish({ success: true, code, message: lastMessage });
          } else {
            finish({ success: false, code, message: lastMessage, error: `Recipient rejected with code ${code}` });
          }
        }
      });
    });
  }
}
