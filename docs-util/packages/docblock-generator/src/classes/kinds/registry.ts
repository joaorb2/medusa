import ts from "typescript"
import FunctionKindGenerator from "./function.js"
import DefaultKindGenerator, { GeneratorOptions } from "./default.js"
import MedusaReactHooksKindGenerator from "./medusa-react-hooks.js"
import SourceFileKindGenerator from "./source-file.js"
import DTOPropertyGenerator from "./dto-property.js"
import OasKindGenerator from "./oas.js"

/**
 * A class that is used as a registry for the kind generators.
 */
class KindsRegistry {
  protected kindInstances: DefaultKindGenerator[]
  protected defaultKindGenerator: DefaultKindGenerator

  constructor(
    options: Pick<
      GeneratorOptions,
      "checker" | "generatorEventManager" | "additionalOptions"
    >
  ) {
    this.kindInstances = [
      new OasKindGenerator(options),
      new MedusaReactHooksKindGenerator(options),
      new FunctionKindGenerator(options),
      new SourceFileKindGenerator(options),
      new DTOPropertyGenerator(options),
    ]
    this.defaultKindGenerator = new DefaultKindGenerator(options)
  }

  /**
   * Retrieve the generator for a node based on its kind, if any.
   *
   * @param {ts.Node} node - The node to retrieve its docblock generator.
   * @returns {DefaultKindGenerator | undefined} The generator that can handle the node's kind, if any.
   */
  getKindGenerator(node: ts.Node): DefaultKindGenerator | undefined {
    return (
      this.kindInstances.find((generator) => generator.isAllowed(node)) ||
      (this.defaultKindGenerator.isAllowed(node)
        ? this.defaultKindGenerator
        : undefined)
    )
  }

  /**
   * Checks whether a node has a kind generator.
   *
   * @param {ts.Node} node - The node to check for.
   * @returns {boolean} Whether the node has a kind generator.
   */
  hasGenerator(node: ts.Node): boolean {
    return this.getKindGenerator(node) !== undefined
  }
}

export default KindsRegistry
