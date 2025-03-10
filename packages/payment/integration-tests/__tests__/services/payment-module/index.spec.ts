import { IPaymentModuleService } from "@medusajs/types"
import { initModules } from "medusa-test-utils"
import { Modules } from "@medusajs/modules-sdk"

import { MikroOrmWrapper } from "../../../utils"
import {
  createPaymentCollections,
  createPaymentSessions,
  createPayments,
} from "../../../__fixtures__"
import { getInitModuleConfig } from "../../../utils/get-init-module-config"

jest.setTimeout(30000)

describe("Payment Module Service", () => {
  describe("Payment Flow", () => {
    let service: IPaymentModuleService
    let shutdownFunc: () => Promise<void>

    afterAll(async () => {
      await shutdownFunc()
    })

    beforeEach(async () => {
      await MikroOrmWrapper.setupDatabase()
      const repositoryManager = await MikroOrmWrapper.forkManager()

      const initModulesConfig = getInitModuleConfig()
      const { medusaApp, shutdown } = await initModules(initModulesConfig)
      service = medusaApp.modules[Modules.PAYMENT]

      shutdownFunc = shutdown

      await createPaymentCollections(repositoryManager)
      await createPaymentSessions(repositoryManager)
      await createPayments(repositoryManager)
    })

    afterEach(async () => {
      await MikroOrmWrapper.clearDatabase()
      await shutdownFunc()
    })
    it("complete payment flow successfully", async () => {
      let paymentCollection = await service.createPaymentCollections({
        currency_code: "USD",
        amount: 200,
        region_id: "reg_123",
      })

      const paymentSession = await service.createPaymentSession(
        paymentCollection.id,
        {
          provider_id: "system",
          providerContext: {
            amount: 200,
            currency_code: "USD",
            payment_session_data: {},
            context: {},
            customer: {},
            billing_address: {},
            email: "test@test.test.com",
            resource_id: "cart_test",
          },
        }
      )

      const payment = await service.authorizePaymentSession(
        paymentSession.id,
        {}
      )

      await service.capturePayment({
        amount: 200,
        payment_id: payment.id,
      })

      await service.completePaymentCollections(paymentCollection.id)

      paymentCollection = await service.retrievePaymentCollection(
        paymentCollection.id,
        { relations: ["payment_sessions", "payments.captures"] }
      )

      expect(paymentCollection).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          currency_code: "USD",
          amount: 200,
          // TODO
          // authorized_amount: 200,
          // status: "authorized",
          region_id: "reg_123",
          deleted_at: null,
          completed_at: expect.any(Date),
          payment_sessions: [
            expect.objectContaining({
              id: expect.any(String),
              currency_code: "USD",
              amount: 200,
              provider_id: "system",
              status: "authorized",
              authorized_at: expect.any(Date),
            }),
          ],
          payments: [
            expect.objectContaining({
              id: expect.any(String),
              amount: 200,
              currency_code: "USD",
              provider_id: "system",
              captures: [
                expect.objectContaining({
                  amount: 200,
                }),
              ],
            }),
          ],
        })
      )
    })
  })

  describe("PaymentCollection", () => {
    let service: IPaymentModuleService
    let shutdownFunc: () => Promise<void>

    afterAll(async () => {
      await shutdownFunc()
    })

    beforeEach(async () => {
      await MikroOrmWrapper.setupDatabase()
      const repositoryManager = await MikroOrmWrapper.forkManager()

      const initModulesConfig = getInitModuleConfig()
      const { medusaApp, shutdown } = await initModules(initModulesConfig)
      service = medusaApp.modules[Modules.PAYMENT]

      shutdownFunc = shutdown

      await createPaymentCollections(repositoryManager)
      await createPaymentSessions(repositoryManager)
      await createPayments(repositoryManager)
    })

    afterEach(async () => {
      await MikroOrmWrapper.clearDatabase()
      await shutdownFunc()
    })

    describe("create", () => {
      it("should throw an error when required params are not passed", async () => {
        let error = await service
          .createPaymentCollections([
            {
              amount: 200,
              region_id: "req_123",
            } as any,
          ])
          .catch((e) => e)

        expect(error.message).toContain(
          "Value for PaymentCollection.currency_code is required, 'undefined' found"
        )

        error = await service
          .createPaymentCollections([
            {
              currency_code: "USD",
              region_id: "req_123",
            } as any,
          ])
          .catch((e) => e)

        expect(error.message).toContain(
          "Value for PaymentCollection.amount is required, 'undefined' found"
        )

        error = await service
          .createPaymentCollections([
            {
              currency_code: "USD",
              amount: 200,
            } as any,
          ])
          .catch((e) => e)

        expect(error.message).toContain(
          "Value for PaymentCollection.region_id is required, 'undefined' found"
        )
      })

      it("should create a payment collection successfully", async () => {
        const [createdPaymentCollection] =
          await service.createPaymentCollections([
            { currency_code: "USD", amount: 200, region_id: "reg_123" },
          ])

        expect(createdPaymentCollection).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            status: "not_paid",
            payment_providers: [],
            payment_sessions: [],
            payments: [],
            currency_code: "USD",
            amount: 200,
          })
        )
      })
    })

    describe("delete", () => {
      it("should delete a Payment Collection", async () => {
        let collection = await service.listPaymentCollections({
          id: ["pay-col-id-1"],
        })

        expect(collection.length).toEqual(1)

        await service.deletePaymentCollections(["pay-col-id-1"])

        collection = await service.listPaymentCollections({
          id: ["pay-col-id-1"],
        })

        expect(collection.length).toEqual(0)
      })
    })

    describe("retrieve", () => {
      it("should retrieve a Payment Collection", async () => {
        let collection = await service.retrievePaymentCollection("pay-col-id-2")

        expect(collection).toEqual(
          expect.objectContaining({
            id: "pay-col-id-2",
            amount: 200,
            region_id: "region-id-1",
            currency_code: "usd",
          })
        )
      })

      it("should fail to retrieve a non existent Payment Collection", async () => {
        let error = await service
          .retrievePaymentCollection("pay-col-id-not-exists")
          .catch((e) => e)

        expect(error.message).toContain(
          "PaymentCollection with id: pay-col-id-not-exists was not found"
        )
      })
    })

    describe("list", () => {
      it("should list and count Payment Collection", async () => {
        let [collections, count] =
          await service.listAndCountPaymentCollections()

        expect(count).toEqual(3)

        expect(collections).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "pay-col-id-1",
              amount: 100,
              region_id: "region-id-1",
              currency_code: "usd",
            }),
            expect.objectContaining({
              id: "pay-col-id-2",
              amount: 200,
              region_id: "region-id-1",
              currency_code: "usd",
            }),
            expect.objectContaining({
              id: "pay-col-id-3",
              amount: 300,
              region_id: "region-id-2",
              currency_code: "usd",
            }),
          ])
        )
      })

      it("should list Payment Collections by region_id", async () => {
        let collections = await service.listPaymentCollections(
          {
            region_id: "region-id-1",
          },
          { select: ["id", "amount", "region_id"] }
        )

        expect(collections.length).toEqual(2)

        expect(collections).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "pay-col-id-1",
              amount: 100,
              region_id: "region-id-1",
            }),
            expect.objectContaining({
              id: "pay-col-id-2",
              amount: 200,
              region_id: "region-id-1",
            }),
          ])
        )
      })
    })

    describe("update", () => {
      it("should update a Payment Collection", async () => {
        await service.updatePaymentCollections({
          id: "pay-col-id-2",
          currency_code: "eur",
          region_id: "reg-2",
        })

        const collection = await service.retrievePaymentCollection(
          "pay-col-id-2"
        )

        expect(collection).toEqual(
          expect.objectContaining({
            id: "pay-col-id-2",
            region_id: "reg-2",
            currency_code: "eur",
          })
        )
      })
    })

    describe("complete", () => {
      it("should complete a Payment Collection", async () => {
        await service.completePaymentCollections("pay-col-id-1")

        const collection = await service.retrievePaymentCollection(
          "pay-col-id-1"
        )

        expect(collection).toEqual(
          expect.objectContaining({
            id: "pay-col-id-1",
            completed_at: expect.any(Date),
          })
        )
      })
    })
  })

  describe("PaymentSession", () => {
    let service: IPaymentModuleService
    let shutdownFunc: () => Promise<void>

    afterAll(async () => {
      await shutdownFunc()
    })

    beforeEach(async () => {
      await MikroOrmWrapper.setupDatabase()
      const repositoryManager = await MikroOrmWrapper.forkManager()

      const initModulesConfig = getInitModuleConfig()
      const { medusaApp, shutdown } = await initModules(initModulesConfig)
      service = medusaApp.modules[Modules.PAYMENT]

      shutdownFunc = shutdown

      await createPaymentCollections(repositoryManager)
      await createPaymentSessions(repositoryManager)
      await createPayments(repositoryManager)
    })

    afterEach(async () => {
      await MikroOrmWrapper.clearDatabase()
      await shutdownFunc()
    })

    describe("create", () => {
      it("should create a payment session successfully", async () => {
        await service.createPaymentSession("pay-col-id-1", {
          provider_id: "system",
          providerContext: {
            amount: 200,
            currency_code: "usd",
            payment_session_data: {},
            context: {},
            customer: {},
            billing_address: {},
            email: "test@test.test.com",
            resource_id: "cart_test",
          },
        })

        const paymentCollection = await service.retrievePaymentCollection(
          "pay-col-id-1",
          { relations: ["payment_sessions"] }
        )

        expect(paymentCollection).toEqual(
          expect.objectContaining({
            id: "pay-col-id-1",
            status: "not_paid",
            payment_sessions: expect.arrayContaining([
              expect.objectContaining({
                id: expect.any(String),
                data: {},
                status: "pending",
                authorized_at: null,
                currency_code: "usd",
                amount: 200,
                provider_id: "system",
              }),
            ]),
          })
        )
      })
    })

    describe("update", () => {
      it("should update a payment session successfully", async () => {
        let session = await service.createPaymentSession("pay-col-id-1", {
          provider_id: "system",
          providerContext: {
            amount: 200,
            currency_code: "usd",
            payment_session_data: {},
            context: {},
            customer: {},
            billing_address: {},
            email: "test@test.test.com",
            resource_id: "cart_test",
          },
        })

        session = await service.updatePaymentSession({
          id: session.id,
          providerContext: {
            amount: 200,
            currency_code: "eur",
            resource_id: "res_id",
            context: {},
            customer: {},
            billing_address: {},
            email: "new@test.tsst",
            payment_session_data: {},
          },
        })

        expect(session).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            status: "pending",
            currency_code: "eur",
            amount: 200,
          })
        )
      })
    })

    describe("authorize", () => {
      it("should authorize a payment session", async () => {
        const collection = await service.createPaymentCollections({
          amount: 200,
          region_id: "test-region",
          currency_code: "usd",
        })

        const session = await service.createPaymentSession(collection.id, {
          provider_id: "system",
          providerContext: {
            amount: 100,
            currency_code: "usd",
            payment_session_data: {},
            context: {},
            resource_id: "test",
            email: "test@test.com",
            billing_address: {},
            customer: {},
          },
        })

        const payment = await service.authorizePaymentSession(session.id, {})

        expect(payment).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            amount: 100,
            authorized_amount: 100,
            currency_code: "usd",
            provider_id: "system",

            refunds: [],
            captures: [],
            data: {},
            cart_id: null,
            order_id: null,
            order_edit_id: null,
            customer_id: null,
            deleted_at: null,
            captured_at: null,
            canceled_at: null,
            payment_collection: expect.objectContaining({
              id: expect.any(String),
            }),
            payment_session: {
              id: expect.any(String),
              currency_code: "usd",
              amount: 100,
              provider_id: "system",
              data: {},
              status: "authorized",
              authorized_at: expect.any(Date),
              payment_collection: expect.objectContaining({
                id: expect.any(String),
              }),
              payment: expect.objectContaining({
                authorized_amount: 100,
                cart_id: null,
                order_id: null,
                order_edit_id: null,
                customer_id: null,
                data: {},
                deleted_at: null,
                captured_at: null,
                canceled_at: null,
                refunds: [],
                captures: [],
                amount: 100,
                currency_code: "usd",
                provider_id: "system",
              }),
            },
          })
        )
      })
    })
  })

  describe("Payment", () => {
    let service: IPaymentModuleService
    let shutdownFunc: () => Promise<void>

    afterAll(async () => {
      await shutdownFunc()
    })

    beforeEach(async () => {
      await MikroOrmWrapper.setupDatabase()
      const repositoryManager = await MikroOrmWrapper.forkManager()

      const initModulesConfig = getInitModuleConfig()
      const { medusaApp, shutdown } = await initModules(initModulesConfig)
      service = medusaApp.modules[Modules.PAYMENT]

      shutdownFunc = shutdown

      await createPaymentCollections(repositoryManager)
      await createPaymentSessions(repositoryManager)
      await createPayments(repositoryManager)
    })

    afterEach(async () => {
      await MikroOrmWrapper.clearDatabase()
      await shutdownFunc()
    })

    describe("update", () => {
      it("should update a payment successfully", async () => {
        const updatedPayment = await service.updatePayment({
          id: "pay-id-1",
          cart_id: "new-cart",
        })

        expect(updatedPayment).toEqual(
          expect.objectContaining({
            id: "pay-id-1",
            cart_id: "new-cart",
          })
        )
      })
    })

    describe("capture", () => {
      it("should capture a payment successfully", async () => {
        const capturedPayment = await service.capturePayment({
          amount: 100,
          payment_id: "pay-id-1",
        })

        expect(capturedPayment).toEqual(
          expect.objectContaining({
            id: "pay-id-1",
            amount: 100,

            captures: [
              expect.objectContaining({
                created_by: null,
                amount: 100,
              }),
            ],

            // TODO: uncomment when totals calculations are implemented
            // captured_amount: 100,
            // captured_at: expect.any(Date),
          })
        )
      })

      // TODO: uncomment when totals are implemented

      //   it("should fail to capture amount greater than authorized", async () => {
      //     const error = await service
      //       .capturePayment({
      //         amount: 200,
      //         payment_id: "pay-id-1",
      //       })
      //       .catch((e) => e)
      //
      //     expect(error.message).toEqual(
      //       "Total captured amount for payment: pay-id-1 exceeds authorised amount."
      //     )
      //   })
      //
      //   it("should fail to capture already captured payment", async () => {
      //     await service.capturePayment({
      //       amount: 100,
      //       payment_id: "pay-id-1",
      //     })
      //
      //     const error = await service
      //       .capturePayment({
      //         amount: 100,
      //         payment_id: "pay-id-1",
      //       })
      //       .catch((e) => e)
      //
      //     expect(error.message).toEqual(
      //       "The payment: pay-id-1 is already fully captured."
      //     )
      //   })
      //
      //   it("should fail to capture a canceled payment", async () => {
      //     await service.cancelPayment("pay-id-1")
      //
      //     const error = await service
      //       .capturePayment({
      //         amount: 100,
      //         payment_id: "pay-id-1",
      //       })
      //       .catch((e) => e)
      //
      //     expect(error.message).toEqual(
      //       "The payment: pay-id-1 has been canceled."
      //     )
      //   })
    })

    describe("refund", () => {
      it("should refund a payments successfully", async () => {
        await service.capturePayment({
          amount: 100,
          payment_id: "pay-id-2",
        })

        const refundedPayment = await service.refundPayment({
          amount: 100,
          payment_id: "pay-id-2",
        })

        expect(refundedPayment).toEqual(
          expect.objectContaining({
            id: "pay-id-2",
            amount: 100,
            refunds: [
              expect.objectContaining({
                created_by: null,
                amount: 100,
              }),
            ],
            // captured_amount: 100,
            // refunded_amount: 100,
          })
        )
      })

      // it("should throw if refund is greater than captured amount", async () => {
      //   await service.capturePayment({
      //     amount: 50,
      //     payment_id: "pay-id-1",
      //   })
      //
      //   const error = await service
      //     .refundPayment({
      //       amount: 100,
      //       payment_id: "pay-id-1",
      //     })
      //     .catch((e) => e)
      //
      //   expect(error.message).toEqual(
      //     "Refund amount for payment: pay-id-1 cannot be greater than the amount captured on the payment."
      //   )
      // })
    })

    describe("cancel", () => {
      it("should cancel a payment", async () => {
        const payment = await service.cancelPayment("pay-id-2")

        expect(payment).toEqual(
          expect.objectContaining({
            id: "pay-id-2",
            canceled_at: expect.any(Date),
          })
        )
      })

      // TODO: revisit when totals are implemented
      // it("should throw if trying to cancel a captured payment", async () => {
      //   await service.capturePayment({ payment_id: "pay-id-2", amount: 100 })
      //
      //   const error = await service
      //     .cancelPayment("pay-id-2")
      //     .catch((e) => e.message)
      //
      //   expect(error).toEqual(
      //     "Cannot cancel a payment: pay-id-2 that has been captured."
      //   )
      // })
    })
  })
})
