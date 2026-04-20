import { StockMatrix } from 'cutlist';
import { z } from 'zod';
import YAML from 'js-yaml';

export function parseStock(stock: string): StockMatrix[] {
  return z.array(StockMatrix).parse(YAML.load(stock));
}
