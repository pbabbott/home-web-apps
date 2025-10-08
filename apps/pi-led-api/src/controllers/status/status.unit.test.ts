import { Request, Response } from 'express';
import { exec } from 'child_process';
import { getStatus, parseConfigFile } from './status';
import * as fs from 'fs';
import * as path from 'path';

// Load the actual example config file once at the top
const CONFIG_PATH = path.join(__dirname, '../../../test/example_config.txt');
const EXAMPLE_CONFIG_CONTENT = fs.readFileSync(CONFIG_PATH, 'utf-8');

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

const mockExec = exec as jest.MockedFunction<typeof exec>;

// Helper function to properly type the callback
type ExecCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

describe('status controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();

    mockRequest = {};
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('should return config when command executes successfully', async () => {
      const mockStdout = `
temp_unit = C
fan_temp = 50
rgb_enable = True
      `.trim();

      mockExec.mockImplementation((command, callback) => {
        expect(command).toBe('bash /dumbledore/bin/pironman -c');
        // Simulate successful execution
        if (callback) {
          (callback as ExecCallback)(null, mockStdout, '');
        }
        return {} as ReturnType<typeof exec>;
      });

      await getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith({
        config: {
          temp_unit: 'C',
          fan_temp: '50',
          rgb_enable: 'True',
        },
      });
    });

    it('should handle empty stdout gracefully', async () => {
      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          (callback as ExecCallback)(null, '', '');
        }
        return {} as ReturnType<typeof exec>;
      });

      await getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith({
        config: {},
      });
    });

    it('should return 500 error when exec fails', async () => {
      const mockError = new Error('Command failed');

      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          (callback as ExecCallback)(mockError, '', '');
        }
        return {} as ReturnType<typeof exec>;
      });

      await getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Command failed',
      });
      expect(console.error).toHaveBeenCalledWith('Exec error: Command failed');
    });

    it('should return 500 error when stderr is present', async () => {
      const mockStderr = 'Permission denied';

      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          (callback as ExecCallback)(null, '', mockStderr);
        }
        return {} as ReturnType<typeof exec>;
      });

      await getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Permission denied',
      });
      expect(console.error).toHaveBeenCalledWith('stderr: Permission denied');
    });
  });

  describe('parseConfigFile', () => {
    it('should handle empty input', () => {
      const result = parseConfigFile('');

      expect(result).toEqual({});
      expect(console.log).toHaveBeenCalledWith('parsing config file');
    });

    it('should parse real config file format', () => {
      const result = parseConfigFile(EXAMPLE_CONFIG_CONTENT);

      expect(result).toEqual({
        temp_unit: 'C',
        fan_temp: '50',
        screen_always_on: 'False',
        screen_off_time: '60',
        rgb_enable: 'True',
        rgb_style: 'breath',
        rgb_color: '00FF00',
        rgb_blink_speed: '50',
        rgb_pwm_freq: '1000',
        rgb_pin: '10',
      });
    });

    it('should handle real config file with getStatus', async () => {
      mockExec.mockImplementation((command, callback) => {
        expect(command).toBe('bash /dumbledore/bin/pironman -c');
        if (callback) {
          (callback as ExecCallback)(null, EXAMPLE_CONFIG_CONTENT, '');
        }
        return {} as ReturnType<typeof exec>;
      });

      await getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith({
        config: {
          temp_unit: 'C',
          fan_temp: '50',
          screen_always_on: 'False',
          screen_off_time: '60',
          rgb_enable: 'True',
          rgb_style: 'breath',
          rgb_color: '00FF00',
          rgb_blink_speed: '50',
          rgb_pwm_freq: '1000',
          rgb_pin: '10',
        },
      });
    });
  });
});
