import { DAL } from "@medusajs/types"
import {
  createPsqlIndexStatementHelper,
  generateEntityId,
} from "@medusajs/utils"
import {
  BeforeCreate,
  Cascade,
  Entity,
  ManyToOne,
  OnInit,
  OptionalProps,
  PrimaryKey,
  Property,
} from "@mikro-orm/core"
import OrderChange from "./order-change"

type OptionalLineItemProps = DAL.EntityDateColumns

const OrderChangeIdIndex = createPsqlIndexStatementHelper({
  tableName: "order_change_action",
  columns: "order_change_id",
})

const ReferenceIdIndex = createPsqlIndexStatementHelper({
  tableName: "order_change_action",
  columns: "reference_id",
})

@Entity({ tableName: "order_change_action" })
export default class OrderChangeAction {
  [OptionalProps]?: OptionalLineItemProps

  @PrimaryKey({ columnType: "text" })
  id: string

  @Property({ columnType: "text" })
  @OrderChangeIdIndex.MikroORMIndex()
  order_change_id: string

  @ManyToOne({
    entity: () => OrderChange,
    fieldName: "order_change_id",
    cascade: [Cascade.REMOVE, Cascade.PERSIST],
  })
  order_change: OrderChange

  @Property({ columnType: "text" })
  reference: string

  @Property({ columnType: "text" })
  @ReferenceIdIndex.MikroORMIndex()
  reference_id: string

  @Property({ columnType: "jsonb" })
  action: Record<string, unknown> = {}

  @Property({ columnType: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null = null

  @Property({
    columnType: "text",
    nullable: true,
  })
  internal_note: string | null = null

  @Property({
    onCreate: () => new Date(),
    columnType: "timestamptz",
    defaultRaw: "now()",
  })
  created_at: Date

  @Property({
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
    columnType: "timestamptz",
    defaultRaw: "now()",
  })
  updated_at: Date

  @BeforeCreate()
  onCreate() {
    this.id = generateEntityId(this.id, "ordchact")
  }

  @OnInit()
  onInit() {
    this.id = generateEntityId(this.id, "ordchact")
  }
}
