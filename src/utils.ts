
import * as path from "path";
import * as fs from "fs";
import * as moment from 'moment';
import { Uri } from "vscode";
import * as os from 'os';



/**
 * Temporary file class
 */
function newTemporaryFilename(prefix = 'markdown_paste'): Uri {
    let tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    return Uri.parse(path.join(tempDir, moment().format("Y-MM-DD-HH-mm-ss")));
}

/**
 * Encode local file data to base64 encoded string
 * @param file 
 * @returns base64 code string
 */
function base64Encode(file: string): string {
    var bitmap = fs.readFileSync(file);
    return Buffer.from(bitmap).toString('base64');
}



export {  base64Encode, newTemporaryFilename };
