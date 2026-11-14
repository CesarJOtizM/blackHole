import { PointOfSaleDirectory } from "@blackhole/inventory/application/ports/point-of-sale-directory";
import { RecipeCopyRepository } from "@blackhole/inventory/application/ports/recipe-copy-repository";
import { StockLedgerRepository } from "@blackhole/inventory/application/ports/stock-ledger-repository";
import { StockMovementQueue } from "@blackhole/inventory/application/ports/stock-movement-queue";
import { type DynamicModule, Module, type Provider } from "@nestjs/common";

import { AuthorizationController } from "#src/http/authorization.controller.js";
import { CashRegisterController } from "#src/http/cash-register.controller.js";
import { DiningRoomController } from "#src/http/dining-room.controller.js";
import { InvoicingController } from "#src/http/invoicing.controller.js";
import { OperateDevicesController } from "#src/http/operate-devices.controller.js";
import { OperateIdentityController } from "#src/http/operate-identity.controller.js";
import { PrintingController } from "#src/http/printing.controller.js";
import { RecipeCopyController } from "#src/http/recipe-copy.controller.js";
import { SensitiveActionsController } from "#src/http/sensitive-actions.controller.js";
import { TaxController } from "#src/http/tax.controller.js";
import { UpdateMenuController } from "#src/http/update-menu.controller.js";
import { UpdateStructureController } from "#src/http/update-structure.controller.js";

const controllers = [
  UpdateMenuController,
  UpdateStructureController,
  OperateIdentityController,
  OperateDevicesController,
  AuthorizationController,
  TaxController,
  DiningRoomController,
  CashRegisterController,
  InvoicingController,
  PrintingController,
  SensitiveActionsController,
  RecipeCopyController,
];

@Module({
  controllers,
})
export class ApplicationModule {}

export interface NodeStockLedger {
  ledger: StockLedgerRepository;
  pointsOfSale: PointOfSaleDirectory;
  movements: StockMovementQueue;
}

export function registerRecipeCopies(
  recipeCopies: RecipeCopyRepository,
): DynamicModule {
  return registerNodeDependencies({ recipeCopies });
}

export function registerStockLedger(stock: NodeStockLedger): DynamicModule {
  return registerNodeDependencies({ stock });
}

export function registerNodeDependencies(input: {
  recipeCopies?: RecipeCopyRepository;
  stock?: NodeStockLedger;
}): DynamicModule {
  const providers: Provider[] = [];

  if (input.recipeCopies) {
    providers.push({
      provide: RecipeCopyRepository,
      useValue: input.recipeCopies,
    });
  }

  if (input.stock) {
    providers.push(
      { provide: StockLedgerRepository, useValue: input.stock.ledger },
      { provide: PointOfSaleDirectory, useValue: input.stock.pointsOfSale },
      { provide: StockMovementQueue, useValue: input.stock.movements },
    );
  }

  return {
    module: ApplicationModule,
    controllers,
    providers,
  };
}
