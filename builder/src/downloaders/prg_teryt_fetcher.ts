import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import * as http from 'node:http';

export interface DownloadSource {
  id: string;
  name: string;
  url: string;
  targetFilename: string;
}

export const OFFICIAL_DATA_SOURCES: Record<string, DownloadSource> = {
  GUGIK_PRG_ADRESY: {
    id: 'prg_adresy',
    name: 'GUGiK Państwowy Rejestr Granic - Punkty Adresowe',
    url: 'https://opendata.geoportal.gov.pl/prg/adresy/PRG_PunktyAdresowe.zip',
    targetFilename: 'PRG_PunktyAdresowe.zip',
  },
  GUS_TERYT_TERC: {
    id: 'teryt_terc',
    name: 'GUS TERYT - TERC (Podział terytorialny)',
    url: 'https://eteryt.stat.gov.pl/eTeryt/app/app/services/xml/TERC.xml',
    targetFilename: 'TERC.xml',
  },
  GUS_TERYT_SIMC: {
    id: 'teryt_simc',
    name: 'GUS TERYT - SIMC (Miejscowości)',
    url: 'https://eteryt.stat.gov.pl/eTeryt/app/app/services/xml/SIMC.xml',
    targetFilename: 'SIMC.xml',
  },
  GUS_TERYT_ULIC: {
    id: 'teryt_ulic',
    name: 'GUS TERYT - ULIC (Ulice)',
    url: 'https://eteryt.stat.gov.pl/eTeryt/app/app/services/xml/ULIC.xml',
    targetFilename: 'ULIC.xml',
  },
};

/**
 * Downloads a file from remote URL with redirect handling and progress feedback.
 */
export async function downloadFile(
  url: string,
  destinationPath: string,
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
): Promise<string> {
  const dir = path.dirname(destinationPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const tempFile = `${destinationPath}.downloading`;
    const fileStream = fs.createWriteStream(tempFile);

    const getProtocol = (u: string) => (u.startsWith('https') ? https : http);

    function executeRequest(targetUrl: string, redirectCount = 0) {
      if (redirectCount > 5) {
        reject(new Error(`Too many redirects for URL: ${url}`));
        return;
      }

      const client = getProtocol(targetUrl);
      const req = client.get(targetUrl, { headers: { 'User-Agent': 'open-pl-address-builder/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (!redirectUrl.startsWith('http')) {
            const parsed = new URL(targetUrl);
            redirectUrl = new URL(redirectUrl, parsed.origin).toString();
          }
          executeRequest(redirectUrl, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          fileStream.close();
          fs.unlink(tempFile, () => {});
          reject(new Error(`Failed to download ${targetUrl}, HTTP status: ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10);
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          fileStream.write(chunk);
          if (onProgress && totalBytes > 0) {
            onProgress(downloadedBytes, totalBytes);
          }
        });

        res.on('end', () => {
          fileStream.end(() => {
            fs.renameSync(tempFile, destinationPath);
            resolve(destinationPath);
          });
        });

        res.on('error', (err) => {
          fileStream.close();
          fs.unlink(tempFile, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => {
        fileStream.close();
        fs.unlink(tempFile, () => {});
        reject(err);
      });
    }

    executeRequest(url);
  });
}
