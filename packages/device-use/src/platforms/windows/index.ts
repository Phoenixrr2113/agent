import { spawn } from 'child_process';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PlatformImplementation, ScreenshotResult } from '../../types.js';
import { imageToBase64 } from '../../utils/image.js';

async function executePowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('powershell.exe', ['-Command', script]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PowerShell command failed: ${stderr || stdout}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export class WindowsPlatform implements PlatformImplementation {
  async screenshot(): Promise<ScreenshotResult> {
    const tempPath = join(tmpdir(), `screenshot-${Date.now()}.png`);

    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
        $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.Left, $screen.Top, 0, 0, $bitmap.Size)
        $bitmap.Save('${tempPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()
      `;

      await executePowerShell(script);
      const base64 = await imageToBase64(tempPath);
      await unlink(tempPath);

      return {
        type: 'image',
        data: base64,
      };
    } catch (error) {
      throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async moveMouse(x: number, y: number): Promise<string> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
      `;
      await executePowerShell(script);
      return `Moved mouse to (${x}, ${y})`;
    } catch (error) {
      throw new Error(`Mouse move failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async click(
    action: 'left_click' | 'right_click' | 'middle_click' | 'double_click',
    coordinate?: [number, number]
  ): Promise<string> {
    try {
      if (coordinate) {
        await this.moveMouse(coordinate[0], coordinate[1]);
      }

      const clickScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $signature = @'
        [DllImport("user32.dll", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
'@
        $SendMouseClick = Add-Type -MemberDefinition $signature -Name "Win32MouseEventNew" -Namespace Win32Functions -PassThru
      `;

      const actionMap: Record<string, string> = {
        'left_click': '$SendMouseClick::mouse_event(0x02, 0, 0, 0, 0); $SendMouseClick::mouse_event(0x04, 0, 0, 0, 0)',
        'right_click': '$SendMouseClick::mouse_event(0x08, 0, 0, 0, 0); $SendMouseClick::mouse_event(0x10, 0, 0, 0, 0)',
        'middle_click': '$SendMouseClick::mouse_event(0x20, 0, 0, 0, 0); $SendMouseClick::mouse_event(0x40, 0, 0, 0, 0)',
        'double_click': '$SendMouseClick::mouse_event(0x02, 0, 0, 0, 0); $SendMouseClick::mouse_event(0x04, 0, 0, 0, 0); Start-Sleep -Milliseconds 50; $SendMouseClick::mouse_event(0x02, 0, 0, 0, 0); $SendMouseClick::mouse_event(0x04, 0, 0, 0, 0)',
      };

      await executePowerShell(clickScript + '\n' + actionMap[action]);
      return `Performed ${action}${coordinate ? ` at (${coordinate[0]}, ${coordinate[1]})` : ''}`;
    } catch (error) {
      throw new Error(`Click failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<string> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $signature = @'
        [DllImport("user32.dll", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
'@
        $SendMouseClick = Add-Type -MemberDefinition $signature -Name "Win32MouseDrag" -Namespace Win32Functions -PassThru
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${fromX}, ${fromY})
        $SendMouseClick::mouse_event(0x02, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 100
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${toX}, ${toY})
        Start-Sleep -Milliseconds 100
        $SendMouseClick::mouse_event(0x04, 0, 0, 0, 0)
      `;
      await executePowerShell(script);
      return `Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})`;
    } catch (error) {
      throw new Error(`Drag failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async typeText(text: string): Promise<string> {
    try {
      const escapedText = text.replace(/'/g, "''");
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')
      `;
      await executePowerShell(script);
      return `Typed text: ${text}`;
    } catch (error) {
      throw new Error(`Type text failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pressKey(key: string): Promise<string> {
    try {
      const keyMap: Record<string, string> = {
        'Return': '{ENTER}',
        'Enter': '{ENTER}',
        'Tab': '{TAB}',
        'Space': ' ',
        'Escape': '{ESC}',
        'Delete': '{DELETE}',
        'Backspace': '{BACKSPACE}',
        'Up': '{UP}',
        'Down': '{DOWN}',
        'Left': '{LEFT}',
        'Right': '{RIGHT}',
      };

      const mappedKey = keyMap[key] || key;
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait('${mappedKey}')
      `;
      await executePowerShell(script);
      return `Pressed key: ${key}`;
    } catch (error) {
      throw new Error(`Press key failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async scroll(x: number, y: number): Promise<string> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $signature = @'
        [DllImport("user32.dll", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, int cButtons, uint dwExtraInfo);
'@
        $SendMouseScroll = Add-Type -MemberDefinition $signature -Name "Win32MouseScroll" -Namespace Win32Functions -PassThru
        $SendMouseScroll::mouse_event(0x0800, 0, 0, ${y * 120}, 0)
      `;
      await executePowerShell(script);
      return `Scrolled by (${x}, ${y})`;
    } catch (error) {
      throw new Error(`Scroll failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCursorPosition(): Promise<string> {
    try {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $position = [System.Windows.Forms.Cursor]::Position
        Write-Output "X: $($position.X), Y: $($position.Y)"
      `;
      const result = await executePowerShell(script);
      return `Cursor position: ${result}`;
    } catch (error) {
      throw new Error(`Get cursor position failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
