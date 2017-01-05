/* global describe, it */

import {exec} from '../../../src/utils/util';
import assert from 'assert';
require('chai').should();

describe("Oi CLI", () => {

  it("can be invoked", () => {
    const result = exec('node dist/bin/oi.js -v');
    result.stdout.trim().should.match(/^\d+\.\d+\.\d+$/);
  });

});
