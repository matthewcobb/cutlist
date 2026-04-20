import { StockMatrix } from 'cutlist';
import { z } from 'zod';
import YAML from 'js-yaml';

export default function () {
  return (stock: string): StockMatrix[] => {
    return z.array(StockMatrix).parse(YAML.load(stock));
  };
}
