export type Board = number[][];

export type TilePosition = {
  row: number;
  column: number;
};

export type TileMovement = {
  fromRow: number;
  fromColumn: number;
  toRow: number;
  toColumn: number;
  value: number;
};

export type MoveResult = {
  board: Board;
  score: number;
  mergedTiles: TilePosition[];
  movedTiles: TileMovement[];
};

type RowMovement = {
  fromColumn: number;
  toColumn: number;
  value: number;
};

type MergeRowResult = {
  row: number[];
  score: number;
  mergedColumns: number[];
  movements: RowMovement[];
};

function mergeRowLeftWithScore(
  row: number[],
): MergeRowResult {
  const numbers = row
    .map((value, column) => ({
      value,
      column,
    }))
    .filter(({ value }) => value !== 0);

  const merged: number[] = [];
  const mergedColumns: number[] = [];
  const movements: RowMovement[] = [];

  let score = 0;

  for (
    let index = 0;
    index < numbers.length;
    index += 1
  ) {
    const current = numbers[index];
    const next = numbers[index + 1];
    const destinationColumn = merged.length;

    if (next && current.value === next.value) {
      const mergedValue = current.value * 2;

      merged.push(mergedValue);
      mergedColumns.push(destinationColumn);

      movements.push({
        fromColumn: current.column,
        toColumn: destinationColumn,
        value: current.value,
      });

      movements.push({
        fromColumn: next.column,
        toColumn: destinationColumn,
        value: next.value,
      });

      score += mergedValue;
      index += 1;
    } else {
      merged.push(current.value);

      movements.push({
        fromColumn: current.column,
        toColumn: destinationColumn,
        value: current.value,
      });
    }
  }

  while (merged.length < row.length) {
    merged.push(0);
  }

  return {
    row: merged,
    score,
    mergedColumns,
    movements,
  };
}

function transposeBoard(board: Board): Board {
  return board[0].map((_, column) =>
    board.map((row) => row[column]),
  );
}

export function moveLeftWithScore(
  board: Board,
): MoveResult {
  let score = 0;

  const mergedTiles: TilePosition[] = [];
  const movedTiles: TileMovement[] = [];

  const movedBoard = board.map((row, rowIndex) => {
    const result = mergeRowLeftWithScore(row);

    score += result.score;

    result.mergedColumns.forEach((column) => {
      mergedTiles.push({
        row: rowIndex,
        column,
      });
    });

    result.movements.forEach((movement) => {
      movedTiles.push({
        fromRow: rowIndex,
        fromColumn: movement.fromColumn,
        toRow: rowIndex,
        toColumn: movement.toColumn,
        value: movement.value,
      });
    });

    return result.row;
  });

  return {
    board: movedBoard,
    score,
    mergedTiles,
    movedTiles,
  };
}

export function moveRightWithScore(
  board: Board,
): MoveResult {
  let score = 0;

  const mergedTiles: TilePosition[] = [];
  const movedTiles: TileMovement[] = [];

  const movedBoard = board.map((row, rowIndex) => {
    const reversedRow = [...row].reverse();
    const result =
      mergeRowLeftWithScore(reversedRow);

    score += result.score;

    result.mergedColumns.forEach(
      (reversedColumn) => {
        mergedTiles.push({
          row: rowIndex,
          column:
            row.length - 1 - reversedColumn,
        });
      },
    );

    result.movements.forEach((movement) => {
      movedTiles.push({
        fromRow: rowIndex,
        fromColumn:
          row.length - 1 - movement.fromColumn,
        toRow: rowIndex,
        toColumn:
          row.length - 1 - movement.toColumn,
        value: movement.value,
      });
    });

    return result.row.reverse();
  });

  return {
    board: movedBoard,
    score,
    mergedTiles,
    movedTiles,
  };
}

export function moveUpWithScore(
  board: Board,
): MoveResult {
  const transposedBoard = transposeBoard(board);
  const result =
    moveLeftWithScore(transposedBoard);

  return {
    board: transposeBoard(result.board),
    score: result.score,

    mergedTiles: result.mergedTiles.map(
      (position) => ({
        row: position.column,
        column: position.row,
      }),
    ),

    movedTiles: result.movedTiles.map(
      (movement) => ({
        fromRow: movement.fromColumn,
        fromColumn: movement.fromRow,
        toRow: movement.toColumn,
        toColumn: movement.toRow,
        value: movement.value,
      }),
    ),
  };
}

export function moveDownWithScore(
  board: Board,
): MoveResult {
  const transposedBoard = transposeBoard(board);
  const result =
    moveRightWithScore(transposedBoard);

  return {
    board: transposeBoard(result.board),
    score: result.score,

    mergedTiles: result.mergedTiles.map(
      (position) => ({
        row: position.column,
        column: position.row,
      }),
    ),

    movedTiles: result.movedTiles.map(
      (movement) => ({
        fromRow: movement.fromColumn,
        fromColumn: movement.fromRow,
        toRow: movement.toColumn,
        toColumn: movement.toRow,
        value: movement.value,
      }),
    ),
  };
}

export function moveLeft(board: Board): Board {
  return moveLeftWithScore(board).board;
}

export function moveRight(board: Board): Board {
  return moveRightWithScore(board).board;
}

export function moveUp(board: Board): Board {
  return moveUpWithScore(board).board;
}

export function moveDown(board: Board): Board {
  return moveDownWithScore(board).board;
}